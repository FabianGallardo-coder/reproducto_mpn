import { NowPlaying } from "../components/nowplaying/NowPlaying";
import type { PageProps } from "./pageTypes";

export function ReproduciendoPage({ controls }: PageProps) {
  void controls;
  return <NowPlaying />;
}
