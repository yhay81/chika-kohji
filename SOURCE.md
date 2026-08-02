# Source and transformation

## Official source

- Publisher: 国土交通省
- Dataset: 国土数値情報 地価公示データ（2026年）
- Source page: <https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2026.html>
- Download: <https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-26/L01-26_GML.zip>
- Price date: 2026-01-01
- Retrieved: 2026-08-02
- Archive: 20,898,568 bytes
- SHA-256: `fad8bbe76d25b682ccf761a492ddc2de001e0345569e044481d62ea84233faf8`
- Coordinate reference: JGD2011

## Dimensions

The official nationwide GeoJSON contains 25,565 unique standard points across all 47 prefectures. Every retained point has a positive current price, address, nearest station and distance, annual change, area, use, and valid coordinates.

## Transformation / 加工

The generator verifies the archive byte length and SHA-256, extracts only the official 2026 GeoJSON, validates the year, dimensions, identifiers, prices, coordinates, and known records, then writes one compact JSON file per prefecture. It retains official point identifiers, addresses, residential display, current price, annual change, site area, current use, neighborhood description, nearest station and distance, zoning, and coordinates.

A search-only display category (residential, commercial, industrial, or other) is derived from the official current-use string. Official values are not summarized or estimated. Files are sorted by current price for deterministic output.

## License and attribution

National Land Numerical Information land-price-publication data from 2019 onward is provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja). This service identifies the source and its transformation. It does not imply endorsement or warranty by the Ministry of Land, Infrastructure, Transport and Tourism.

## Interpretation boundary

The current price is the normal price per square metre for a published standard point as of 2026-01-01. It is not an appraisal of an arbitrary parcel, a transaction price, a building-inclusive price, a roadside land value, or prefectural land-price-survey data.
