cask "rustmd" do
  version "1.10.6"
  sha256 "b8dade64a9cca5b2f9ec2df2fbb88c913e092a68ee49f9223d7ce259011344ca"

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
