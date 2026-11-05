package com.flowplayer.app

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

private data class MediaRequest(val command: String, val args: JSONObject)
private class MetadataReadException(name: String, cause: RuntimeException) :
    Exception("No se pudo leer \"$name\": el audio está dañado o su formato no es compatible", cause)

@TauriPlugin
class MediaPlugin(private val activity: Activity) : Plugin(activity) {
    private val worker = Executors.newSingleThreadExecutor()
    private val preferences = activity.getSharedPreferences("flowplayer-media", 0)
    private val tracks = mutableMapOf<String, JSONObject>()
    private val radioCatalog by lazy {
        activity.assets.open("stations.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
    private var controller: MediaController? = null
    private var webView: WebView? = null
    private val future = MediaController.Builder(
        activity, SessionToken(activity, ComponentName(activity, PlaybackService::class.java))
    ).buildAsync()

    init {
        future.addListener({
            try {
                controller = future.get()
            } catch (error: Exception) {
                Log.e("FlowPlayer", "Cannot connect to media service", error)
            }

        }, ContextCompat.getMainExecutor(activity))
    }

    override fun load(webView: WebView) {
        this.webView = webView
    }

    override fun onPause() {
        webView?.evaluateJavascript("window.dispatchEvent(new Event('flowplayer-background'))", null)
    }

    private fun config(): JSONObject = JSONObject(preferences.getString("config", null) ?: """
        {"music_folder":"","volume":0.8,"shuffle":false,"repeat":"off",
         "last_track_index":null,"last_position":0,"favorites":[],
         "custom_playlists":[],"custom_radio_stations":[]}
    """)

    private fun saveConfig(value: JSONObject) {
        check(preferences.edit().putString("config", value.toString()).commit()) {
            "No se pudo guardar la configuración"
        }
    }

    private fun result(invoke: Invoke, value: Any? = null) {
        invoke.resolve(JSObject().put("value", value ?: JSONObject.NULL))
    }

    private fun fail(invoke: Invoke, error: Exception) {
        Log.e("FlowPlayer", "Android media operation failed", error)
        invoke.reject(error.message ?: error.javaClass.simpleName)
    }

    private fun metadata(uri: Uri): JSONObject {
        require(uri.scheme == "content") { "Se requiere un archivo del selector Android" }
        val document = DocumentFile.fromSingleUri(activity, uri)
            ?: error("No se pudo leer el documento")
        val retriever = MediaMetadataRetriever()
        try {
            try {
                retriever.setDataSource(activity, uri)
            } catch (error: RuntimeException) {
                if (error is SecurityException) throw error
                throw MetadataReadException(document.name ?: "Audio", error)
            }
            fun field(key: Int, fallback: String) = retriever.extractMetadata(key) ?: fallback
            val track = JSONObject()
                .put("path", uri.toString())
                .put("title", field(MediaMetadataRetriever.METADATA_KEY_TITLE, document.name ?: "Audio"))
                .put("artist", field(MediaMetadataRetriever.METADATA_KEY_ARTIST, "Desconocido"))
                .put("album", field(MediaMetadataRetriever.METADATA_KEY_ALBUM, ""))
                .put("duration", field(MediaMetadataRetriever.METADATA_KEY_DURATION, "0").toDouble() / 1000)
            synchronized(tracks) { tracks[uri.toString()] = track }
            return track
        } finally {
            retriever.release()
        }
    }

    private fun scan(path: String): JSONObject {
        require(path.isNotEmpty()) { "Seleccioná una carpeta de música" }
        val root = DocumentFile.fromTreeUri(activity, Uri.parse(path))
            ?: error("La carpeta no está disponible; volvé a seleccionarla")
        check(root.canRead()) { "El permiso de la carpeta fue revocado" }
        val found = JSONArray()
        val warnings = JSONArray()
        fun visit(folder: DocumentFile) {
            for (file in folder.listFiles()) {
                if (file.isDirectory) visit(file)
                else if (file.type?.startsWith("audio/") == true ||
                    file.name?.substringAfterLast('.')?.lowercase() in
                    setOf("mp3", "wav", "flac", "ogg", "m4a", "aac", "opus")) {
                    try {
                        found.put(metadata(file.uri))
                    } catch (error: MetadataReadException) {
                        Log.w("FlowPlayer", "Skipping an unreadable audio document", error)
                        warnings.put(error.message)
                    }
                }
            }
        }
        visit(root)
        return JSONObject().put("tracks", found).put("warnings", warnings)
    }

    private fun mediaItem(track: JSONObject): MediaItem {
        val uri = Uri.parse(track.getString("path"))
        val bundledHttpRadio = uri.scheme == "http" && JSONArray(radioCatalog).let { stations ->
            (0 until stations.length()).any {
                stations.getJSONObject(it).getString("url") == uri.toString()
            }
        }
        require(uri.scheme == "content" || uri.scheme == "https" || bundledHttpRadio) {
            "Solo se permite audio local seleccionado, radio HTTPS o una radio HTTP del catálogo incluido"
        }
        return MediaItem.Builder().setUri(uri).setMediaId(uri.toString())
            .setMediaMetadata(MediaMetadata.Builder().setTitle(track.getString("title"))
                .setArtist(track.getString("artist")).setAlbumTitle(track.getString("album")).build())
            .build()
    }

    private fun state(player: Player): JSONObject {
        player.playerError?.let { throw IllegalStateException("Error de reproducción: ${it.message}", it) }
        val position = player.currentPosition.coerceAtLeast(0) / 1000.0
        val duration = if (player.duration == C.TIME_UNSET) 0.0 else player.duration.coerceAtLeast(0) / 1000.0
        return JSONObject().put("playing", player.playWhenReady && player.playbackState != Player.STATE_ENDED)
            .put("position", position).put("duration", duration).put("volume", player.volume.toDouble())
            .put("current_track", player.currentMediaItem?.mediaId ?: JSONObject.NULL)
    }

    private fun historyFile() = File(activity.filesDir, "history.json")
    private fun history(): JSONArray {
        val file = historyFile()
        return if (file.exists()) JSONArray(file.readText()) else JSONArray()
    }
    private fun writeHistory(entries: JSONArray) {
        val file = historyFile()
        val temp = File(activity.filesDir, "history.tmp")
        temp.writeText(entries.toString())
        check(temp.renameTo(file)) { "No se pudo guardar el historial" }
    }

    @Command
    fun execute(invoke: Invoke) {
        if (!future.isDone) {
            future.addListener({ execute(invoke) }, ContextCompat.getMainExecutor(activity))
            return
        }
        val request = try {
            val value = JSONObject(invoke.getRawArgs())
            MediaRequest(value.getString("command"), value.getJSONObject("args"))
        } catch (error: Exception) {
            fail(invoke, error)
            return
        }
        val args = request.args
        when (request.command) {
            "select_folder", "select_file" -> {
                val intent = if (request.command == "select_folder") Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
                else Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    type = "audio/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                startActivityForResult(invoke, intent, "selected")
            }
            "scan_folder", "get_track_info", "get_cover", "record_play", "get_history", "clear_history" ->
                worker.execute {
                    try {
                        val value: Any? = when (request.command) {
                            "scan_folder" -> scan(args.getString("path"))
                            "get_track_info" -> metadata(Uri.parse(args.getString("path")))
                            "get_cover" -> {
                                val retriever = MediaMetadataRetriever()
                                try {
                                    retriever.setDataSource(activity, Uri.parse(args.getString("path")))
                                    retriever.embeddedPicture?.let { bytes ->
                                        JSONArray(bytes.map { it.toInt() and 255 })
                                    }
                                } finally { retriever.release() }
                            }
                            "get_history" -> history()
                            "clear_history" -> { writeHistory(JSONArray()); null }
                            else -> {
                                val entry = args.getJSONObject("entry")
                                val entries = history()
                                val last = if (entries.length() > 0) entries.getJSONObject(0) else null
                                if (last == null || last.getString("path") != entry.getString("path") ||
                                    kotlin.math.abs(last.getLong("playedAt") - entry.getLong("playedAt")) >= 5000) {
                                    val updated = JSONArray().put(entry)
                                    for (i in 0 until minOf(entries.length(), 1999)) updated.put(entries.get(i))
                                    writeHistory(updated)
                                }
                                null
                            }
                        }
                        result(invoke, value)
                    } catch (error: Exception) { fail(invoke, error) }
                }
            else -> activity.runOnUiThread {
                try {
                    val player = controller ?: future.get().also { controller = it }
                    val value: Any? = when (request.command) {
                        "get_config" -> config()
                        "set_config" -> { saveConfig(args.getJSONObject("config")); null }
                        "get_state" -> state(player)
                        "pause" -> { player.pause(); null }
                        "prepare_youtube" -> { player.stop(); player.clearMediaItems(); null }
                        "resume" -> {
                            if (player.playbackState == Player.STATE_ENDED) player.seekToDefaultPosition()
                            player.prepare(); player.play(); null
                        }
                        "seek" -> {
                            val seconds = args.getDouble("position")
                            require(seconds.isFinite() && seconds >= 0) { "Posición inválida" }
                            player.seekTo((seconds * 1000).toLong()); null
                        }
                        "set_volume" -> {
                            val volume = args.getDouble("volume")
                            require(volume.isFinite() && volume in 0.0..1.0) { "Volumen inválido" }
                            player.volume = volume.toFloat()
                            saveConfig(config().put("volume", volume)); null
                        }
                        "set_shuffle" -> {
                            player.shuffleModeEnabled = args.getBoolean("on")
                            saveConfig(config().put("shuffle", player.shuffleModeEnabled)); null
                        }
                        "set_repeat" -> {
                            val mode = args.getString("mode")
                            player.repeatMode = when (mode) {
                                "one" -> Player.REPEAT_MODE_ONE
                                "all" -> Player.REPEAT_MODE_ALL
                                "off" -> Player.REPEAT_MODE_OFF
                                else -> error("Repetición inválida")
                            }
                            saveConfig(config().put("repeat", mode)); null
                        }
                        "set_playlist" -> {
                            val list = args.getJSONArray("tracks")
                            val index = args.getInt("index")
                            require(index in 0 until list.length()) { "Lista o posición inválida" }
                            val items = (0 until list.length()).map { i ->
                                val track = list.getJSONObject(i)
                                synchronized(tracks) { tracks[track.getString("path")] = track }
                                mediaItem(track)
                            }
                            player.setMediaItems(items, index, 0)
                            player.prepare(); player.play(); null
                        }
                        "next", "previous" -> {
                            if (request.command == "next") player.seekToNextMediaItem()
                            else player.seekToPreviousMediaItem()
                            player.currentMediaItem?.let { item ->
                                synchronized(tracks) { tracks[item.mediaId] } ?: JSONObject()
                                    .put("path", item.mediaId)
                                    .put("title", item.mediaMetadata.title?.toString() ?: "Audio")
                                    .put("artist", item.mediaMetadata.artist?.toString() ?: "")
                                    .put("album", item.mediaMetadata.albumTitle?.toString() ?: "")
                                    .put("duration", if (player.duration == C.TIME_UNSET) 0.0 else player.duration / 1000.0)
                            }
                        }
                        "play_url" -> {
                            val url = args.getString("url")
                            val item = JSONObject().put("path", url).put("title", "Radio")
                                .put("artist", "Radio").put("album", "Radio").put("duration", 0)
                            player.setMediaItem(mediaItem(item)); player.prepare(); player.play(); null
                        }
                        "list_radio_stations" -> {
                            val list = JSONArray(radioCatalog)
                            val custom = config().getJSONArray("custom_radio_stations")
                            for (i in 0 until custom.length()) list.put(custom.get(i))
                            list
                        }
                        "search" -> {
                            val query = args.getString("query")
                            synchronized(tracks) {
                                JSONArray(tracks.values.filter { track ->
                                    listOf("title", "artist", "album").any { track.optString(it).contains(query, true) }
                                })
                            }
                        }
                        "youtube_library" -> JSONObject().put("version", 1)
                            .put("songs", JSONArray()).put("playlists", JSONArray()).put("jobs", JSONArray())
                        "youtube_search" -> error("En Android abrí un enlace de YouTube. La búsqueda integrada requiere configurar la API oficial.")
                        "youtube_enqueue", "youtube_inspect", "youtube_cancel", "youtube_retry" ->
                            error("Las descargas de YouTube no están disponibles en Android.")
                        "fetch_lyrics" -> error("Las letras en Android todavía no están disponibles.")
                        "set_window_mode" -> {
                            require(args.getString("mode") in setOf("normal", "flow", "zen", "mini")) { "Modo inválido" }
                            null // Android modes are in-app views, never desktop windows.
                        }
                        "update_smtc_metadata" -> {
                            // YouTube owns visible playback; never attach it to the native background service.
                            null
                        }
                        "open_external" -> {
                            val uri = Uri.parse(args.getString("url"))
                            require(uri.scheme == "https") { "Se requiere HTTPS" }
                            activity.startActivity(Intent(Intent.ACTION_VIEW, uri)); null
                        }
                        else -> error("Comando Android no implementado: ${request.command}")
                    }
                    result(invoke, value)
                } catch (error: Exception) { fail(invoke, error) }
            }
        }
    }

    @ActivityCallback
    fun selected(invoke: Invoke, response: ActivityResult) {
        try {
            val data = response.data
            val uri = data?.data
            if (response.resultCode != Activity.RESULT_OK || uri == null) {
                result(invoke)
                return
            }
            activity.contentResolver.takePersistableUriPermission(
                uri, data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            result(invoke, uri.toString())
        } catch (error: Exception) { fail(invoke, error) }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        MediaController.releaseFuture(future)
        worker.shutdown()
        super.onDestroy(activity)
    }
}
