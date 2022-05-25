# BitbucketData
Script to gather pull-requests metrics from Bitbucket using a AWS lambda and a Google Spreadsheet.

## Assumptions:
- The lambda must have external access (but you can protect using a API-KEY)
- The google spreadsheet must have some configuration cells
- You need to use a valid credential key for the bitbucket

## Testing the script
- npm run dev
- npm start
