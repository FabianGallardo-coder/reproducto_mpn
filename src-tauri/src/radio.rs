use std::collections::VecDeque;
use std::io::{Read, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};

use serde::{Deserialize, Serialize};
use url::Url;

const MAX_HLS_DEPTH: u32 = 5;

#[derive(Debug, PartialEq, Eq)]
struct HlsSegment {
    sequence: u64,
    url: Url,
}

#[derive(Debug)]
struct HlsPlaylist {
    variants: Vec<Url>,
    segments: Vec<HlsSegment>,
    target_duration: std::time::Duration,
    end_list: bool,
}

fn is_hls_url(url: &Url) -> bool {
    url.path().to_ascii_lowercase().ends_with(".m3u8")
}

fn is_new_hls_segment(sequence: u64, previous_sequence: Option<u64>) -> bool {
    previous_sequence.is_none_or(|previous| sequence > previous)
}

fn parse_hls_playlist(base_url: &Url, body: &str) -> Result<HlsPlaylist, url::ParseError> {
    let mut variants = Vec::new();
    let mut segments = Vec::new();
    let mut sequence = 0;
    let mut target_duration = std::time::Duration::from_secs(2);
    let mut end_list = false;
    let mut next_line_is_variant = false;

    for line in body.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if let Some(value) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
            if let Ok(value) = value.parse::<u64>() {
                sequence = value;
            }
        } else if let Some(value) = line.strip_prefix("#EXT-X-TARGETDURATION:") {
            if let Ok(seconds) = value.parse::<u64>() {
                target_duration = std::time::Duration::from_secs(seconds.max(1));
            }
        } else if line.starts_with("#EXT-X-STREAM-INF:") {
            next_line_is_variant = true;
        } else if line == "#EXT-X-ENDLIST" {
            end_list = true;
        } else if !line.starts_with('#') {
            let resolved = base_url.join(line)?;
            if next_line_is_variant {
                variants.push(resolved);
                next_line_is_variant = false;
            } else {
                segments.push(HlsSegment {
                    sequence,
                    url: resolved,
                });
                sequence = sequence.saturating_add(1);
            }
        }
    }

    Ok(HlsPlaylist {
        variants,
        segments,
        target_duration,
        end_list,
    })
}

async fn fetch_hls_playlist(
    client: &reqwest::Client,
    mut playlist_url: Url,
    cancelled: &AtomicBool,
) -> Result<(Url, HlsPlaylist), String> {
    for _ in 0..MAX_HLS_DEPTH {
        if cancelled.load(Ordering::Relaxed) {
            return Err("HLS playback cancelled".into());
        }

        let response = client
            .get(playlist_url.clone())
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|error| error.to_string())?;
        let body = response.text().await.map_err(|error| error.to_string())?;
        let playlist =
            parse_hls_playlist(&playlist_url, &body).map_err(|error| error.to_string())?;

        if let Some(variant_url) = playlist.variants.first() {
            playlist_url = variant_url.clone();
        } else {
            return Ok((playlist_url, playlist));
        }
    }

    Err("HLS variant playlist nesting exceeds the supported depth".into())
}

async fn forward_response(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| error.to_string())?;

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::Relaxed) {
            return Ok(());
        }

        let bytes = chunk.map_err(|error| error.to_string())?;
        loop {
            if cancelled.load(Ordering::Relaxed) {
                return Ok(());
            }
            let buffered = shared.lock().map(|buffer| buffer.len()).unwrap_or(0);
            if buffered < BUFFER_HIGH_WATERMARK {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        if tx.send(bytes.to_vec()).is_err() {
            return Ok(());
        }
    }

    Ok(())
}

async fn forward_hls(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) {
    let mut previous_sequence = None;

    while !cancelled.load(Ordering::Relaxed) {
        let (_playlist_url, playlist) =
            match fetch_hls_playlist(client, url.clone(), cancelled).await {
                Ok(playlist) => playlist,
                Err(error) => {
                    if !cancelled.load(Ordering::Relaxed) {
                        log::warn!("[stream] HLS playlist request failed: {error}");
                    }
                    return;
                }
            };

        for segment in playlist.segments {
            if !is_new_hls_segment(segment.sequence, previous_sequence) {
                continue;
            }

            if let Err(error) = forward_response(client, segment.url, tx, shared, cancelled).await {
                if !cancelled.load(Ordering::Relaxed) {
                    log::warn!("[stream] HLS segment request failed: {error}");
                }
                return;
            }
            previous_sequence = Some(segment.sequence);
        }

        if playlist.end_list {
            return;
        }

        let interval = playlist.target_duration;
        let mut slept = std::time::Duration::ZERO;
        while slept < interval && !cancelled.load(Ordering::Relaxed) {
            let step = (interval - slept).min(std::time::Duration::from_millis(200));
            tokio::time::sleep(step).await;
            slept += step;
        }
    }
}

async fn forward_direct_stream(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) {
    const MAX_ATTEMPTS: u32 = 3;
    for attempt in 0..MAX_ATTEMPTS {
        if cancelled.load(Ordering::Relaxed) {
            return;
        }
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000 * attempt as u64)).await;
        }

        match forward_response(client, url.clone(), tx, shared, cancelled).await {
            Ok(()) => return,
            Err(error) => {
                if !cancelled.load(Ordering::Relaxed) {
                    log::warn!("[stream] attempt {attempt}: request failed: {error}");
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadioStation {
    pub name: String,
    pub genre: String,
    pub url: String,
    pub description: String,
}

fn somafm_stations() -> Vec<RadioStation> {
    vec![
        RadioStation {
            name: "Groove Salad".into(),
            genre: "Ambient / Downtempo".into(),
            url: "https://ice1.somafm.com/groovesalad-128-mp3".into(),
            description: "A nicely chilled plate of ambient beats and grooves".into(),
        },
        RadioStation {
            name: "Drone Zone".into(),
            genre: "Ambient".into(),
            url: "https://ice1.somafm.com/dronezone-128-mp3".into(),
            description: "Atmospheric textures with beats and samples".into(),
        },
        RadioStation {
            name: "Space Station".into(),
            genre: "Electronic / Space".into(),
            url: "https://ice1.somafm.com/spacestation-128-mp3".into(),
            description: "Spaced-out ambient and mid-tempo electronica".into(),
        },
        RadioStation {
            name: "DEF CON".into(),
            genre: "Electronic / Hacker".into(),
            url: "https://ice1.somafm.com/defcon-128-mp3".into(),
            description: "DEF CON hacker convention radio".into(),
        },
        RadioStation {
            name: "Fluid".into(),
            genre: "Instrumental Hip-Hop".into(),
            url: "https://ice1.somafm.com/fluid-128-mp3".into(),
            description: "Instrumental hip-hop beats and grooves".into(),
        },
        RadioStation {
            name: "The Trip".into(),
            genre: "House / Techno".into(),
            url: "https://ice1.somafm.com/thetrip-128-mp3".into(),
            description: "Progressive house / trance. Tip top tunes".into(),
        },
        RadioStation {
            name: "Seventies".into(),
            genre: "70s Rock / Pop".into(),
            url: "https://ice1.somafm.com/seventies-128-mp3".into(),
            description: "James at 60's big hits and deep cuts".into(),
        },
        RadioStation {
            name: "Metal Detector".into(),
            genre: "Metal".into(),
            url: "https://ice1.somafm.com/metal-128-mp3".into(),
            description: "All metal. All the time".into(),
        },
    ]
}

fn argentine_stations() -> Vec<RadioStation> {
    vec![
        // AM Nacionales - Buenos Aires
        RadioStation { name: "Radio Madre (530 AM)".into(), genre: "AM Radio".into(), url: "http://cdn.instream.audio:9288/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Colonia (550 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/COLONIAAAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Argentina (570 AM)".into(), genre: "AM Radio".into(), url: "https://server.laradio.online:15224/live.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Continental (590 AM)".into(), genre: "AM Radio".into(), url: "https://edge05.radiohdvivo.com/continental".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Rivadavia (630 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/RIVADAVIAAAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio 10 (710 AM)".into(), genre: "AM Radio".into(), url: "https://radio10.stweb.tv/radio10/live/chunks.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "AM 750".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/AM750AAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Cooperativa (770 AM)".into(), genre: "AM Radio".into(), url: "https://cdn.instream.audio:9582/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Mitre (790 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/AM790_56AAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Zónica (820 AM)".into(), genre: "AM Radio".into(), url: "https://streamlky.alsolnet.com/radiozonica".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Del Pueblo (830 AM)".into(), genre: "AM Radio".into(), url: "https://streaming6.locucionar.com:24248/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Nacional (870 AM)".into(), genre: "AM Radio".into(), url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad1".into(), description: "Buenos Aires".into() },
        RadioStation { name: "La Red (910 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/LA_RED_AM910AAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "CNN Radio (950 AM)".into(), genre: "AM Radio".into(), url: "https://unlimited2-ar.dps.live/cnn-ar/aac/icecast.audio".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Génesis (970 AM)".into(), genre: "AM Radio".into(), url: "https://01.solumedia.com.ar:8216/;".into(), description: "Buenos Aires".into() },
        RadioStation { name: "La 990 (990 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/AM990AAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Onda Latina (1010 AM)".into(), genre: "AM Radio".into(), url: "https://streaming2.locucionar.com/proxy/ondalatina?mp=/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Del Plata (1030 AM)".into(), genre: "AM Radio".into(), url: "https://streaming01.shockmedia.com.ar:10217/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Güemes (1050 AM)".into(), genre: "AM Radio".into(), url: "https://server.radiostreaming.com.ar/8564/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "De la Ciudad (1110 AM)".into(), genre: "AM Radio".into(), url: "https://radio01.ferozo.com/proxy/ra01001160?mp=/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio La Luna (1140 AM)".into(), genre: "AM Radio".into(), url: "http://ohradio.cc:9344/;".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Federal (1180 AM)".into(), genre: "AM Radio".into(), url: "https://sonic.host-live.com/8176/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Perfil (1190 AM)".into(), genre: "AM Radio".into(), url: "https://jireh-1-hls-audio-br-isp.dps.live/hls-audio/4e252a65837b69e349d5d8c1033152b4/perfil/playlist/manifest/gotardisz/audio/now/livestream1.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Radio Sur (1200 AM)".into(), genre: "AM Radio".into(), url: "https://stream.xweb.ar:8008/;".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Eco Medios (1220 AM)".into(), genre: "AM Radio".into(), url: "https://stream-159.zeno.fm/uv3vkhw2qvduv".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Buenos Aires (1350 AM)".into(), genre: "AM Radio".into(), url: "https://nl.digitalrm.pt:8052/stream".into(), description: "Buenos Aires".into() },
        // FM CABA
        RadioStation { name: "La Tribu (88.7 FM)".into(), genre: "FM Radio".into(), url: "https://radio01.ferozo.com/proxy/ra01000659?mp=/;".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Malena (89.1 FM)".into(), genre: "FM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/MALENAAAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Arpeggio (89.5 FM)".into(), genre: "FM Radio".into(), url: "https://cloudstream2032.conectarhosting.com/8074/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio con Vos (89.9 FM)".into(), genre: "FM Radio".into(), url: "https://server1.stweb.tv/rcvos/live/chunks.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "La Boca (90.1 FM)".into(), genre: "FM Radio".into(), url: "https://s24.myradiostream.com/14984/listen.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Delta (90.3 FM)".into(), genre: "FM Radio".into(), url: "https://cdn.instream.audio//:9069//stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Zero (92.5 FM)".into(), genre: "FM Radio".into(), url: "https://radiozero.fm/reproductor/proxy/".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Nacional Rock (93.7 FM)".into(), genre: "Rock".into(), url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad1".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Disney (94.3 FM)".into(), genre: "Pop".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/DISNEY_ARG_BA_ADP.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Metro (95.1 FM)".into(), genre: "Pop".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/METRO.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Concepto (95.5 FM)".into(), genre: "FM Radio".into(), url: "https://radios.solumedia.com:6002/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Rock & Pop (95.9 FM)".into(), genre: "Rock".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/ROCKANDPOPAAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Nacional Clásica (96.7 FM)".into(), genre: "Classical".into(), url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad37".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Mucha Radio (97.1 FM)".into(), genre: "Pop".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/MUCHA_RADIO.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Vale (97.5 FM)".into(), genre: "Pop".into(), url: "https://vale.stweb.tv/vale/live/chunks.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Cultura (97.9 FM)".into(), genre: "Culture".into(), url: "https://usa5.fastcast4u.com/proxy/radiocultura?mp=/1".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Mega (98.3 FM)".into(), genre: "Pop".into(), url: "https://mega.stweb.tv/mega983/live/chunks.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Nacional Folklórica (98.7 FM)".into(), genre: "Folklore".into(), url: "https://sa.mp3.icecast.magma.edge-access.net/sc_rad38".into(), description: "Buenos Aires".into() },
        RadioStation { name: "La 100 (99.9 FM)".into(), genre: "Pop".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/FM999_56.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Blue (100.7 FM)".into(), genre: "Pop".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/BLUE_FM_100_7AAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Latina (101.1 FM)".into(), genre: "Pop".into(), url: "http://streaming.latina101.com.ar:9000/Repetidoras".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Pop (101.5 FM)".into(), genre: "Pop".into(), url: "https://popradio.stweb.tv/popradio/live/chunks.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Aspen (102.3 FM)".into(), genre: "Rock".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3".into(), description: "Buenos Aires".into() },
        RadioStation { name: "D Sports (103.1 FM)".into(), genre: "Sports".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/DSPORTSRADIOAAC_SC".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Sonido (103.5 FM)".into(), genre: "FM Radio".into(), url: "https://streaming.radiosenlinea.com.ar/8780/stream/1/".into(), description: "Buenos Aires".into() },
        RadioStation { name: "One (103.7 FM)".into(), genre: "FM Radio".into(), url: "https://one.stweb.tv/one/live/playlist.m3u8".into(), description: "Buenos Aires - HLS".into() },
        RadioStation { name: "Urbana Play (104.3 FM)".into(), genre: "Pop".into(), url: "https://cdn.instream.audio:9660/stream".into(), description: "Buenos Aires".into() },
        RadioStation { name: "La Nación + Música (104.9 FM)".into(), genre: "Pop".into(), url: "https://stream.radio.co/s2ed3bec0a/listen".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Los 40 (105.5 FM)".into(), genre: "Pop".into(), url: "https://radios.solumedia.com:6158/stream?icy=http".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Milenium (106.7 FM)".into(), genre: "Rock".into(), url: "http://23.111.184.195:8020/mileniumrosario.mp3".into(), description: "Rosario".into() },
        RadioStation { name: "Infobae FM".into(), genre: "News".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/INFOBAEAAC.aac".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Vorterix".into(), genre: "Rock".into(), url: "https://ice2.edge-apps.net/radio1_high-20057.audio".into(), description: "Buenos Aires".into() },
        RadioStation { name: "NOW 97.9".into(), genre: "Pop".into(), url: "https://cdn.instream.audio:9604/stream".into(), description: "Buenos Aires".into() },
        // Provinciales
        RadioStation { name: "Radio Pasión (102.7 FM)".into(), genre: "FM Radio".into(), url: "https://cdn.instream.audio/stream/9790".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio Berlín (107.9 FM)".into(), genre: "FM Radio".into(), url: "https://unlimited5-us.dps.live/berlin/aac/icecast.audio".into(), description: "Buenos Aires".into() },
        RadioStation { name: "Radio María (101.5 FM)".into(), genre: "Religious".into(), url: "https://play1.radiomaria.org.ar/".into(), description: "Córdoba".into() },
        RadioStation { name: "Radio Universidad (580 AM)".into(), genre: "AM Radio".into(), url: "https://radios.solumedia.com:10976/stream".into(), description: "Córdoba".into() },
        RadioStation { name: "Radio LT3 Rosario (680 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/LT3AAC_SC".into(), description: "Santa Fe".into() },
        RadioStation { name: "Cadena Heat (91.9 FM)".into(), genre: "Pop".into(), url: "https://liveradio.mediainbox.net/fmcordoba.mp3".into(), description: "Córdoba".into() },
        RadioStation { name: "Radio Suquía (96.5 FM)".into(), genre: "FM Radio".into(), url: "https://streaming01.shockmedia.com.ar:10945/;".into(), description: "Córdoba".into() },
        RadioStation { name: "Cadena 3 FM (100.5 FM)".into(), genre: "Pop".into(), url: "https://liveradio.mediainbox.net/radio3.mp3".into(), description: "Córdoba".into() },
        RadioStation { name: "Radio Mía (104.1 FM)".into(), genre: "FM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/FM1041_56AAC.aac".into(), description: "Córdoba".into() },
        RadioStation { name: "Cadena 3 AM (700 AM)".into(), genre: "AM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/AM700.mp3".into(), description: "Córdoba".into() },
        RadioStation { name: "Estación del Sol (96.7 FM)".into(), genre: "FM Radio".into(), url: "https://estaciondelsolonline.com.ar:8000/radio.aac".into(), description: "Mendoza".into() },
        RadioStation { name: "Nihuil FM (101.9 FM)".into(), genre: "FM Radio".into(), url: "https://playerservices.streamtheworld.com/api/livestream-redirect/NIHUIL_AM680.mp3".into(), description: "Mendoza".into() },
        RadioStation { name: "Aire de Santa Fe (92.5 FM)".into(), genre: "FM Radio".into(), url: "https://unlimited1-us.dps.live/airedesantafetv/airedesantafetv.smil/playlist.m3u8".into(), description: "Santa Fe - HLS".into() },
        RadioStation { name: "LT10 Radio UNL (97.3 FM)".into(), genre: "FM Radio".into(), url: "https://radio.arcast.net:1060/stream".into(), description: "Santa Fe".into() },
        RadioStation { name: "LT2 Radio 2 (1230 AM)".into(), genre: "AM Radio".into(), url: "https://streaming320tb.locucionar.com/proxy/radio2?mp=/stream/1/".into(), description: "Rosario".into() },
        RadioStation { name: "LU5 (600 AM)".into(), genre: "AM Radio".into(), url: "http://live.lu5am.com:8000/LU5".into(), description: "Neuquén".into() },
        RadioStation { name: "La Red Neuquén (93.7 FM)".into(), genre: "FM Radio".into(), url: "https://server.laradio.online/proxy/julian_liyo?mp=/stream".into(), description: "Neuquén".into() },
        RadioStation { name: "LU9 (690 AM)".into(), genre: "AM Radio".into(), url: "https://sonic.host-live.com/8064/stream".into(), description: "Cipolletti".into() },
        RadioStation { name: "Río Negro Radio (90.9 FM)".into(), genre: "FM Radio".into(), url: "https://01.solumedia.com.ar:7004/stream".into(), description: "Neuquén/Roca".into() },
        RadioStation { name: "Cosmos FM".into(), genre: "FM Radio".into(), url: "http://s28.myradiostream.com:28240/listen.m3u".into(), description: "San Juan".into() },
        RadioStation { name: "Radio 3 Trelew".into(), genre: "FM Radio".into(), url: "https://radio01.ferozo.com/proxy/ra01000981?mp=/stream".into(), description: "Chubut".into() },
        RadioStation { name: "FM Del Mar".into(), genre: "FM Radio".into(), url: "https://icecast.gesatel.com.ar:8443/vivo".into(), description: "Comodoro Rivadavia".into() },
        RadioStation { name: "LU9 Mar del Plata (670 AM)".into(), genre: "AM Radio".into(), url: "https://servidor1.hostradios.com:8110/stream".into(), description: "Mar del Plata".into() },
        RadioStation { name: "LU6 Radio Atlántica (760 AM)".into(), genre: "AM Radio".into(), url: "https://streaming.escuchanosonline.com:7056/stream".into(), description: "Mar del Plata".into() },
        RadioStation { name: "LU2 Radio Bahía Blanca (840 AM)".into(), genre: "AM Radio".into(), url: "https://streaming6.locucionar.com:24228/stream?ver=22915".into(), description: "Bahía Blanca".into() },
    ]
}

pub fn preset_stations() -> Vec<RadioStation> {
    let mut stations = somafm_stations();
    stations.extend(argentine_stations());
    stations
}

// Thresholds for backpressure (in bytes)
const BUFFER_HIGH_WATERMARK: usize = 1_500_000; // pause download above 1.5 MB
const BUFFER_LOW_WATERMARK: usize = 1_000_000; // resume download below 1.0 MB

struct RingBuffer {
    buf: VecDeque<u8>,
    max_size: usize,
}

impl RingBuffer {
    fn new(max_size: usize) -> Self {
        Self {
            buf: VecDeque::with_capacity(max_size.min(1024 * 1024)),
            max_size,
        }
    }

    fn push(&mut self, data: &[u8]) {
        self.buf.extend(data.iter());
        if self.buf.len() > self.max_size {
            self.buf.drain(..self.buf.len() - self.max_size);
        }
    }

    fn read_from(&mut self, dest: &mut [u8]) -> usize {
        let n = dest.len().min(self.buf.len());
        for byte in &mut dest[..n] {
            *byte = self.buf.pop_front().unwrap_or(0);
        }
        n
    }

    fn len(&self) -> usize {
        self.buf.len()
    }
}

pub struct StreamReader {
    rx: Mutex<mpsc::Receiver<Vec<u8>>>,
    shared: Arc<Mutex<RingBuffer>>,
    /// Condvar used to wake the downloader when buffer drains below low watermark
    drain_signal: Arc<(Mutex<bool>, Condvar)>,
    pos: u64,
    /// Cancellation token to stop the download thread
    cancelled: Arc<AtomicBool>,
}

impl StreamReader {
    pub fn new(url: &str) -> Self {
        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        let shared = Arc::new(Mutex::new(RingBuffer::new(4 * 1024 * 1024))); // 4 MB ring
        let drain_signal = Arc::new((Mutex::new(false), Condvar::new()));
        let cancelled = Arc::new(AtomicBool::new(false)); // Cancellation token
        let url = url.to_string();

        let shared_dl = Arc::clone(&shared);
        let cancelled_dl = Arc::clone(&cancelled);

        tauri::async_runtime::spawn(async move {
            let client = reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .user_agent("FlowPlayer/0.1")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new());

            match Url::parse(&url) {
                Ok(parsed) if is_hls_url(&parsed) => {
                    forward_hls(&client, parsed, &tx, &shared_dl, &cancelled_dl).await;
                }
                Ok(parsed) => {
                    forward_direct_stream(&client, parsed, &tx, &shared_dl, &cancelled_dl).await;
                }
                Err(error) => {
                    log::warn!("[stream] invalid URL: {error}");
                }
            }
        });

        Self {
            rx: Mutex::new(rx),
            shared,
            drain_signal,
            pos: 0,
            cancelled,
        }
    }
}

impl Read for StreamReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        // Drain chunks from the channel into the ring buffer
        if let Ok(rx) = self.rx.lock() {
            while let Ok(chunk) = rx.try_recv() {
                if let Ok(mut rb) = self.shared.lock() {
                    rb.push(&chunk);
                }
            }
        }

        // Try to serve from the ring buffer
        if let Ok(mut rb) = self.shared.lock() {
            let n = rb.read_from(buf);
            if n > 0 {
                self.pos += n as u64;
                // --- BACKPRESSURE: notify downloader when buffer drains below low watermark ---
                if rb.len() < BUFFER_LOW_WATERMARK {
                    let (lock, cvar) = &*self.drain_signal;
                    if let Ok(mut paused) = lock.lock() {
                        *paused = false;
                        cvar.notify_one();
                    }
                }
                // ---------------------------------------------------------------------------
                return Ok(n);
            }
        }

        // Buffer empty: wait for data with timeout to avoid blocking the audio thread indefinitely.
        if let Ok(rx) = self.rx.lock() {
            match rx.recv_timeout(std::time::Duration::from_secs(5)) {
                Ok(chunk) => {
                    if let Ok(mut rb) = self.shared.lock() {
                        rb.push(&chunk);
                        let n = rb.read_from(buf);
                        self.pos += n as u64;
                        if rb.len() < BUFFER_LOW_WATERMARK {
                            let (lock, cvar) = &*self.drain_signal;
                            if let Ok(mut paused) = lock.lock() {
                                *paused = false;
                                cvar.notify_one();
                            }
                        }
                        return Ok(n);
                    }
                }
                Err(_) => {
                    log::debug!("[stream] recv timeout or channel closed");
                }
            }
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::UnexpectedEof,
            "stream ended",
        ))
    }
}

impl Seek for StreamReader {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        match pos {
            SeekFrom::Current(0) => Ok(self.pos),
            SeekFrom::Current(offset) => {
                self.pos = self.pos.saturating_add_signed(offset);
                Ok(self.pos)
            }
            SeekFrom::Start(p) => {
                self.pos = p;
                Ok(self.pos)
            }
            SeekFrom::End(_) => Ok(self.pos),
        }
    }
}

impl Drop for StreamReader {
    fn drop(&mut self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_buffer_push_and_read() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"hello");
        let mut out = [0u8; 5];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 5);
        assert_eq!(&out, b"hello");
    }

    #[test]
    fn ring_buffer_evicts_oldest() {
        let mut rb = RingBuffer::new(10);
        rb.push(b"1234567890abcdef");
        assert!(rb.len() <= 10);
        let mut out = [0u8; 10];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 10);
        assert_eq!(&out, b"7890abcdef");
    }

    #[test]
    fn ring_buffer_read_empty() {
        let mut rb = RingBuffer::new(10);
        let mut out = [0u8; 5];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 0);
    }

    #[test]
    fn ring_buffer_partial_read() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"hi");
        let mut out = [0u8; 10];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 2);
        assert_eq!(&out[..2], b"hi");
    }

    #[test]
    fn ring_buffer_push_drains_correctly() {
        let mut rb = RingBuffer::new(5);
        rb.push(b"abcde");
        assert_eq!(rb.len(), 5);
        rb.push(b"fghij");
        assert_eq!(rb.len(), 5);
        let mut out = [0u8; 5];
        rb.read_from(&mut out);
        assert_eq!(&out, b"fghij");
    }

    #[test]
    fn seek_current_zero_returns_pos() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"data");
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 42,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(0)).unwrap(), 42);
    }

    #[test]
    fn seek_start_sets_pos() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 0,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Start(100)).unwrap(), 100);
        assert_eq!(sr.pos, 100);
    }

    #[test]
    fn seek_current_positive_offset() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 10,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(5)).unwrap(), 15);
    }

    #[test]
    fn seek_current_negative_saturates() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 3,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(-10)).unwrap(), 0);
    }

    #[test]
    fn preset_stations_not_empty() {
        let stations = preset_stations();
        assert!(stations.len() > 10);
    }

    #[test]
    fn preset_stations_have_urls() {
        let stations = preset_stations();
        for s in &stations {
            assert!(!s.url.is_empty(), "station {} has no URL", s.name);
            assert!(!s.name.is_empty(), "station has no name");
        }
    }

    #[test]
    fn hls_playlist_resolves_relative_segments_and_media_sequence() {
        let playlist_url = Url::parse("https://radio.example/live/index.m3u8").unwrap();
        let playlist = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:12\n#EXTINF:4,\nseg-12.ts\n#EXTINF:4,\nseg-13.ts\n",
        )
        .unwrap();

        assert_eq!(playlist.segments.len(), 2);
        assert_eq!(playlist.segments[0].sequence, 12);
        assert_eq!(
            playlist.segments[0].url.as_str(),
            "https://radio.example/live/seg-12.ts"
        );
        assert_eq!(playlist.segments[1].sequence, 13);
        assert_eq!(
            playlist.segments[1].url.as_str(),
            "https://radio.example/live/seg-13.ts"
        );
        assert!(!playlist.end_list);
    }

    #[test]
    fn reloaded_hls_playlist_skips_consumed_segments_and_yields_new_ones() {
        let playlist_url = Url::parse("https://radio.example/live/index.m3u8").unwrap();
        let first = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:20\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n",
        )
        .unwrap();
        let last_consumed = first.segments.last().map(|segment| segment.sequence);
        let reloaded = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:20\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n#EXTINF:4,\nc.ts\n",
        )
        .unwrap();

        let new_segments: Vec<_> = reloaded
            .segments
            .iter()
            .filter(|segment| is_new_hls_segment(segment.sequence, last_consumed))
            .collect();

        assert_eq!(new_segments.len(), 1);
        assert_eq!(
            new_segments[0].url.as_str(),
            "https://radio.example/live/c.ts"
        );
    }
}
