cask "rustmd" do
  version "1.11.0"
  sha256 "0a94f14ca750dad12cd45790a6d164ff107d48fa0d8bd5449f14eb3df650b6bb"

  # The current release ships an Apple Silicon (arm64) build only.
  url "https://github.com/riverzhou/rustmd/releases/download/v#{version}/rustmd-#{version}-macos-arm64.dmg",
      verified: "github.com/riverzhou/rustmd/"
  name "rustmd"
  desc "Local-first Markdown, HTML, CSV, TXT and JSON notes"
  homepage "https://github.com/riverzhou/rustmd"

  depends_on arch: :arm64
  depends_on macos: ">= :catalina"

  app "rustmd.app"

  zap trash: [
    "~/Library/Application Support/com.river.rustmd",
    "~/Library/Caches/com.river.rustmd",
    "~/Library/Preferences/com.river.rustmd.plist",
    "~/Library/Saved Application State/com.river.rustmd.savedState",
    "~/Library/WebKit/com.river.rustmd",
  ]
end
