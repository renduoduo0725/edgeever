import type { GooglePlayUpdateResult, GooglePlayUpdateState } from "../../modules/edgeever-app-store";

type PlayUpdateApi = {
  check: () => Promise<GooglePlayUpdateState>;
  start: () => Promise<GooglePlayUpdateResult>;
};

/** Owns Play consent and state recovery independently of GitHub release availability. */
export class MobilePlayUpdate {
  state: GooglePlayUpdateState = { status: "unavailable", versionCode: 0 };
  hasKnownUpdate = false;
  private promptedVersions = new Set<number>();
  private starting: Promise<GooglePlayUpdateResult> | null = null;
  private revision = 0;

  constructor(private api: PlayUpdateApi, private onState: (state: GooglePlayUpdateState) => void) {}

  receive = (state: GooglePlayUpdateState) => {
    this.revision += 1;
    this.state = state;
    if (state.status !== "unavailable") this.hasKnownUpdate = true;
    this.onState(state);
  };

  async check(prompt: boolean): Promise<boolean> {
    const revision = this.revision;
    const state = await this.api.check();
    // An install event received during the request is more recent than its snapshot.
    if (revision === this.revision) this.receive(state);
    if (prompt && this.state.status === "available" && !this.promptedVersions.has(this.state.versionCode)) {
      await this.start();
    }
    return this.state.status !== "unavailable";
  }

  start(): Promise<GooglePlayUpdateResult> {
    if (this.starting) return this.starting;
    this.promptedVersions.add(this.state.versionCode);
    const revision = this.revision;
    this.starting = this.api.start().then((result) => {
      if (result === "unavailable") {
        this.receive({ ...this.state, status: "unavailable" });
      } else if (result === "accepted" && revision === this.revision) {
        this.receive({ ...this.state, status: "downloading" });
      }
      return result;
    }).finally(() => { this.starting = null; });
    return this.starting;
  }
}
