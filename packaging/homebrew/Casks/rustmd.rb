cask "rustmd" do
  version "1.10.5"
  sha256 "5156a7cd181ff83f82b6391c5563ad601121a388d25aa8c8aed54d316e03a0d8"

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
