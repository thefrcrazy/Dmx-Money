import { useState, useEffect } from "react";

export interface GitHubRelease {
  version: string;
  assets: {
    macOS: {
      silicon: string;
      intel: string;
      universal: string;
    };
    windows: {
      setup: string;
      msi: string;
    };
    linux: {
      appImage: string;
      deb: string;
      rpm: string;
    };
  };
  isLoading: boolean;
}

export const FALLBACK_VERSION = "0.7.1";
const REPO_URL = "https://github.com/thefrcrazy/Dmx-Money";

export function useGitHubRelease(): GitHubRelease {
  const [data, setData] = useState<GitHubRelease>({
    version: FALLBACK_VERSION,
    assets: {
      macOS: {
        silicon: `${REPO_URL}/releases/latest`,
        intel: `${REPO_URL}/releases/latest`,
        universal: `${REPO_URL}/releases/latest`,
      },
      windows: {
        setup: `${REPO_URL}/releases/latest`,
        msi: `${REPO_URL}/releases/latest`,
      },
      linux: {
        appImage: `${REPO_URL}/releases/latest`,
        deb: `${REPO_URL}/releases/latest`,
        rpm: `${REPO_URL}/releases/latest`,
      },
    },
    isLoading: true,
  });

  useEffect(() => {
    fetch("https://api.github.com/repos/thefrcrazy/Dmx-Money/releases/latest")
      .then((res) => res.json())
      .then((release) => {
        if (release && release.tag_name) {
          const version = release.tag_name.replace("v", "");
          const findAsset = (pattern: RegExp) =>
            release.assets.find((a: any) => pattern.test(a.name))?.browser_download_url || `${REPO_URL}/releases/latest`;

          const assets = {
            macOS: {
              silicon: findAsset(/_aarch64_.*\.dmg$/),
              intel: findAsset(/_x64_.*\.dmg$/),
              universal: findAsset(/\.dmg$/), // Fallback to any DMG if specific ones miss, though universal usually covers both
            },
            windows: {
              setup: findAsset(/_x64-setup.*\.exe$/),
              msi: findAsset(/_x64_.*\.msi$/),
            },
            linux: {
              appImage: findAsset(/\.AppImage$/),
              deb: findAsset(/\.deb$/),
              rpm: findAsset(/\.rpm$/),
            },
          };
          setData({ version, assets, isLoading: false });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch latest release:", err);
        setData((prev) => ({ ...prev, isLoading: false }));
      });
  }, []);

  return data;
}
