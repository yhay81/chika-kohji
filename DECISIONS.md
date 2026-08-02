# Decisions

## Compare conditions, not just prices

Land-price comparison without use, station distance, area, zoning, and neighborhood context is misleading. Each point card keeps those conditions beside the price, and the comparison tray preserves them.

## Split data by prefecture

The official nationwide dataset contains 25,565 points. The browser downloads only the national index and the selected prefecture, keeping the first visit light while supporting cross-prefecture comparison through four locally stored public records.

## No embedded map

The primary task is searching and comparing official attributes. Avoiding third-party map tiles reduces initial weight, external requests, and location-query leakage. Official coordinates remain available in the data.

## No authentication

The comparison tray stores four public records locally. Accounts would add friction and private-data handling without improving the core task.
