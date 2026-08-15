export class SettingsUI {
  constructor(state, onChange) {
    this.state = state;
    this.onChange = onChange;
    this.dialog = document.querySelector("#settingsDialog");
    this.settingsButton = document.querySelector("#settingsButton");
    this.soundButton = document.querySelector("#soundButton");
    this.soundIcon = document.querySelector("#soundIcon");
    this.bgmToggle = document.querySelector("#bgmToggle");
    this.bgmVolume = document.querySelector("#bgmVolume");
    this.volumeValue = document.querySelector("#volumeValue");
    this.seToggle = document.querySelector("#seToggle");
  }

  mount() {
    this.sync();

    this.settingsButton.addEventListener("click", () => this.dialog.showModal());
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });

    this.soundButton.addEventListener("click", () => {
      this.state.settings.bgmEnabled = !this.state.settings.bgmEnabled;
      this.sync();
      this.onChange?.(this.state.settings);
    });

    this.bgmToggle.addEventListener("change", () => {
      this.state.settings.bgmEnabled = this.bgmToggle.checked;
      this.sync();
      this.onChange?.(this.state.settings);
    });

    this.bgmVolume.addEventListener("input", () => {
      this.state.settings.bgmVolume = Number(this.bgmVolume.value);
      this.sync();
      this.onChange?.(this.state.settings);
    });

    this.seToggle.addEventListener("change", () => {
      this.state.settings.seEnabled = this.seToggle.checked;
      this.sync();
      this.onChange?.(this.state.settings);
    });
  }

  sync() {
    const { bgmEnabled, bgmVolume, seEnabled } = this.state.settings;
    this.bgmToggle.checked = bgmEnabled;
    this.bgmVolume.value = String(bgmVolume);
    this.volumeValue.textContent = `${bgmVolume}%`;
    this.seToggle.checked = seEnabled;
    this.soundIcon.textContent = bgmEnabled && bgmVolume > 0 ? "🔊" : "🔇";
  }
}
