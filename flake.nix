{
  description = "Kye development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    flake-utils,
    fenix,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };

        buildToolsVersion = "34.0.0";
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          buildToolsVersions = [buildToolsVersion "35.0.0"];
          platformVersions = ["34" "35" "36"];
          includeEmulator = false;
          includeNDK = true;
          ndkVersions = ["26.1.10909125"]; # Version NDK souvent recommandée pour Tauri
          cmakeVersions = ["3.22.1"];
          includeSources = false;
          includeSystemImages = false;
          extraLicenses = [
            "android-sdk-license"
            "android-sdk-preview-license"
          ];
        };
        androidSdk = androidComposition.androidsdk;

        rust = fenix.packages.${system}.combine [
          fenix.packages.${system}.stable.cargo
          fenix.packages.${system}.stable.clippy
          fenix.packages.${system}.stable.rust-src
          fenix.packages.${system}.stable.rustc
          fenix.packages.${system}.stable.rustfmt
          fenix.packages.${system}.stable.rust-analyzer
          fenix.packages.${system}.targets.aarch64-linux-android.stable.rust-std
          fenix.packages.${system}.targets.armv7-linux-androideabi.stable.rust-std
          fenix.packages.${system}.targets.i686-linux-android.stable.rust-std
          fenix.packages.${system}.targets.x86_64-linux-android.stable.rust-std
        ];

        libraries = with pkgs; [
          webkitgtk_4_1
          gtk3
          cairo
          gdk-pixbuf
          glib
          dbus
          librsvg
          libsoup_3
          glib-networking
        ];

        packages =
          libraries
          ++ (with pkgs; [
            pkg-config
            bun
            rust
            cargo-tauri
            cargo-watch
            just
            typescript
            typescript-language-server

            jdk17
            android-tools
            androidSdk
          ]);
      in {
        devShells.default = pkgs.mkShell {
          inherit packages;

          JAVA_HOME = "${pkgs.jdk17}/lib/openjdk";
          ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
          NDK_HOME = "${androidSdk}/libexec/android-sdk/ndk/26.1.10909125";
          GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${androidSdk}/libexec/android-sdk/build-tools/${buildToolsVersion}/aapt2";
          GIO_MODULE_DIR = "${pkgs.glib-networking}/lib/gio/modules/";

          shellHook = ''
            export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath libraries}:$LD_LIBRARY_PATH
          '';
        };
      }
    );
}
