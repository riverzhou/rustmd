cask "rustmd" do
  version "1.10.7"
  sha256 "e4e9dad981ca2786d01ca9c6f8f81749af90e16084e9d1f63c6702e7de201c40"

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
