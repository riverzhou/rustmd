cask "rustmd" do
  version "1.12.0"
  sha256 "23b263f5afd6a4b73752c88e9126e966440fe86948a066c634e46c3c2474700b"

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
