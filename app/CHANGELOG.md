# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.2.0](https://github.com/CoRExE/JudeBox/compare/v1.1.1...v1.2.0) (2026-03-19)


### Features

* add local ID3 parsing for offline cover images ([1adbfbe](https://github.com/CoRExE/JudeBox/commit/1adbfbeda22a532a26b52c77cc2d7a1a79f60cba))


### Bug Fixes

* add global Buffer polyfill for music-metadata-browser ([7c6eff9](https://github.com/CoRExE/JudeBox/commit/7c6eff94612bc61ad86ee2ebaac418f04ad06acc))
* read entire audio file to prevent unexpected end of file during local ID3 parsing ([4baa426](https://github.com/CoRExE/JudeBox/commit/4baa426896fce147c1146fccefff49ba91b62cc2))
* resolve socket memory leaks and allow host rejoining rooms ([6bcaf1e](https://github.com/CoRExE/JudeBox/commit/6bcaf1eb659bfc6e38bc5de78dde751b2d79ec30))
* update expo-file-system to legacy import for SDK 54 compatibility ([7261756](https://github.com/CoRExE/JudeBox/commit/7261756c769042f8bae51919fec4b57ef257a6d4))

### [1.1.1](https://github.com/CoRExE/JudeBox/compare/v1.1.0...v1.1.1) (2026-03-19)


### Bug Fixes

* add expo-audio plugin to app.json ([fdae2ab](https://github.com/CoRExE/JudeBox/commit/fdae2ab01978365f6f21f956198cc8c9b77afc24))

## 1.1.0 (2026-03-19)


### Features

* add background audio, lockscreen controls and standard-version ([8efd660](https://github.com/CoRExE/JudeBox/commit/8efd660131323f3bea4c5f95cfe6a417d97c7853))
* add offline player mode without room creation ([94e8883](https://github.com/CoRExE/JudeBox/commit/94e8883211059e6b575672c60e36a5b3baafe607))
* **audio:** improve playback and local library integration ([c398564](https://github.com/CoRExE/JudeBox/commit/c3985644d4db977d630705d5eacf9ef1ff834d0e))
* playlists management and custom toast notifications ([bad21a8](https://github.com/CoRExE/JudeBox/commit/bad21a8a1829759b03aa5bbbb9b835b48ca0effb))
