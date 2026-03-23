# API Response Spec

Tai lieu nay mapping cac field output cua actor `compass/crawler-google-places` theo 4 cot:

- `Field name`
- `Y nghia`
- `Can bat option nao`
- `Co mat phi khong`

## Luu y cach doc

- `Khong`: docs hien tai khong danh dau option lien quan bang `($)`.
- `Co`: docs danh dau option lien quan bang `($)` hoac mo ta day la add-on tinh phi.
- `Gian tiep`: field nay khong duoc docs noi la tinh phi rieng, nhung chi xuat hien khi mot option co phi da duoc bat.
- Nhieu field co the la `null`, `[]`, hoac vang mat neu Google Maps khong hien thi du lieu do.
- Neu crawl bang `placeIds` hoac direct Google Maps place URL, docs co ghi chu day la luong "additional place details" va co the phat sinh phi.

## 1. Base place output

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `searchString` | Query, URL, hoac direct detail reference tao ra item nay | Khong can | Khong | Huu ich de trace item den input |
| `rank` | Thu hang cua place trong ket qua tim kiem | Khong can | Khong | Co the `null` neu crawl bang direct URL/place ID |
| `searchPageUrl` | URL trang search ban dau | Khong can | Khong | Co the `null` |
| `searchPageLoadedUrl` | URL thuc te sau khi Google Maps load xong | Khong can | Khong | Co the `null` |
| `isAdvertisement` | Danh dau place co phai ket qua quang cao hay khong | Khong can | Khong | Boolean |
| `title` | Ten dia diem/doanh nghiep | Khong can | Khong | Field chinh de hien thi |
| `subTitle` | Tieu de phu | Khong can | Khong | Co the `null` |
| `description` | Mo ta ngan tren listing/detail | Khong can | Khong | Co the `null` |
| `categoryName` | Nhom danh muc chinh cua place | Khong can | Khong | Vi du `Cafe`, `Restaurant` |
| `categories` | Toan bo category ma Google Maps gan cho place | Khong can | Khong | Mang string |
| `placeId` | Google Place ID | Khong can | Khong | Dung de dedupe va fetch lai |
| `fid` | Google internal feature ID | Khong can | Khong | Internal identifier |
| `cid` | Google internal CID | Khong can | Khong | Hay dung khi xu ly link `?cid=` |
| `kgmid` | Knowledge Graph ID | Khong can | Khong | Co the `null` |
| `url` | URL Google Maps cua place | Khong can | Khong | Direct link toi place |
| `address` | Dia chi day du | Khong can | Khong | Field text tong hop |
| `street` | So nha + ten duong | Khong can | Khong | Co the `null` |
| `neighborhood` | Khu vuc/phuong/quan nho | Khong can | Khong | Co the `null` |
| `city` | Thanh pho | Khong can | Khong | Co the `null` |
| `state` | Tinh/bang | Khong can | Khong | Co the `null` |
| `postalCode` | Ma buu chinh | Khong can | Khong | Co the `null` |
| `countryCode` | Ma quoc gia | Khong can | Khong | Vi du `US`, `VN` |
| `location.lat` | Vi do | Khong can | Khong | Nam trong object `location` |
| `location.lng` | Kinh do | Khong can | Khong | Nam trong object `location` |
| `plusCode` | Google Plus Code | Khong can | Khong | Co the `null` |
| `locatedIn` | Ten dia diem cha ma place nam ben trong | Khong can | Khong | Vi du shop trong mall |
| `parentPlaceUrl` | URL cua place cha | Thuong chi co y nghia khi `scrapeDirectories=true` | Gian tiep | Huu ich khi crawl businesses ben trong mall/shopping center |
| `website` | Website chinh cua doanh nghiep | Khong can | Khong | Co the `null` |
| `phone` | So dien thoai dinh dang hien thi | Khong can | Khong | Co the `null` |
| `phoneUnformatted` | So dien thoai dang chuan hoa hon | Khong can | Khong | Co the `null` |
| `price` | Muc gia/price bracket | Khong can | Khong | Vi du `$$`, `$10-20` |
| `menu` | URL menu neu co | Khong can | Khong | Thuong gap voi restaurant |
| `claimThisBusiness` | Co hien "Claim this business" hay khong | Khong can | Khong | Boolean |
| `totalScore` | Diem danh gia trung binh | Khong can | Khong | Co the `null` neu chua co review |
| `permanentlyClosed` | Dong cua vinh vien | Khong can | Khong | Boolean |
| `temporarilyClosed` | Dong cua tam thoi | Khong can | Khong | Boolean |
| `scrapedAt` | Thoi diem actor lay du lieu | Khong can | Khong | ISO datetime |
| `imageUrl` | Anh dai dien/chinh cua place | Khong can | Khong | Khac voi `images[]` |
| `imagesCount` | Tong so anh ma Google Maps hien | Khong can | Khong | Docs co trong sample output |
| `googleFoodUrl` | Link ordering/food co lien quan den Google | Khong can | Khong | Co the `null`; docs khong mo ta them |
| `gasPrices` | Gia xang neu place la tram xang | Khong can | Khong | Mang du lieu chuyen biet |
| `userPlaceNote` | Ghi chu ca nhan lien quan den place | Khong can | Khong | Thuong `null` |

## 2. Detail-page fields

Nhung field duoi day theo docs can bat `scrapePlaceDetailPage=true`, hoac duoc docs noi ro la chi co khi mo detail page.

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `reviewsCount` | Tong so review | `scrapePlaceDetailPage=true` de duoc guarantee | Co | Docs ghi detail page "also ensures that `reviewsCount` is scraped" |
| `reviewsDistribution.oneStar` ... `fiveStar` | Phan bo so review theo tung muc sao | `scrapePlaceDetailPage=true` | Co | Object nested |
| `imageCategories` | Cac nhom anh trong Google Maps | `scrapePlaceDetailPage=true` | Co | Vi du `Food & drink`, `By owner` |
| `openingHours[]` | Gio mo cua theo ngay | `scrapePlaceDetailPage=true` | Co | Mang object `{ day, hours }` |
| `popularTimes` | Histogram gio dong khach/live occupancy | `scrapePlaceDetailPage=true` | Co | Docs co liet ke, khong co sample schema day du |
| `BusinessConfirmationText` | Chu xac nhan/business confirmation | `scrapePlaceDetailPage=true` | Co | Docs chi liet ke ten field, chua co sample |
| `peopleAlsoSearch[]` | Cac place lien quan ma nguoi dung thuong xem cung | `scrapePlaceDetailPage=true` | Co | Moi item thuong co `category`, `title`, `reviewsCount`, `totalScore` |
| `reviewsTags[]` | Keyword/tag duoc trich tu review | `scrapePlaceDetailPage=true` | Co | Moi item thuong co `title`, `count` |
| `placesTags[]` | Tag mo ta place | `scrapePlaceDetailPage=true` neu Google co hien | Co | Sample output de `[]` |
| `additionalInfo` | Tien ich va dac tinh chi tiet | `scrapePlaceDetailPage=true` | Co | Object dong, vi du `Service options`, `Accessibility`, `Payments` |
| `questionsAndAnswers[]` | Cau hoi va cau tra loi cua nguoi dung | `scrapePlaceDetailPage=true`, co the them `maxQuestions` | Co | `maxQuestions=0` theo docs van co the lay cau dau tien |
| `updatesFromCustomers` | Cap nhat tu khach hang | `scrapePlaceDetailPage=true` | Co | Docs co sample `null` |
| `ownerUpdates[]` | Cap nhat tu chu dia diem/doanh nghiep | `scrapePlaceDetailPage=true` | Co | Mang |
| `tableReservationLinks[]` | Link dat ban/doi tac dat ban | `scrapePlaceDetailPage=true` | Co | Khac voi provider enrichment |
| `orderBy[]` | Link/order provider de dat mon | `scrapePlaceDetailPage=true` | Co | Moi item thuong co `name`, `orderUrl` |
| `hotelStars` | Hang sao cua khach san | `scrapePlaceDetailPage=true` | Co | Chi co y nghia voi hotel |
| `hotelDescription` | Mo ta khach san | `scrapePlaceDetailPage=true` | Co | String dai |
| `checkInDate`, `checkOutDate` | Ngay check-in/check-out ma Google dang hien | `scrapePlaceDetailPage=true` | Co | Thuong co voi hotel |
| `similarHotelsNearby[]` | Khach san tuong tu gan do | `scrapePlaceDetailPage=true` | Co | Moi item thuong co `name`, `rating`, `reviews`, `description`, `price` |
| `hotelReviewSummary` | Tong ket review cho hotel | `scrapePlaceDetailPage=true` | Co | Docs co nhac ten field, sample de `null` |
| `hotelAds[]` | Danh sach quang cao/offer booking hotel | `scrapePlaceDetailPage=true` | Co | Moi item co the co `title`, `googleUrl`, `isOfficialSite`, `price`, `url` |

## 3. Optional paid sections on top of detail page

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `webResults[]` | Muc "Web results" o cuoi listing | `includeWebResults=true` | Co | Docs khong dua sample schema day du |
| Place items ben trong mall/shopping center | Actor crawl them cac business nam trong place cha | `scrapeDirectories=true` va detail page | Co | Dau ra thuong lien quan toi `parentPlaceUrl`, `locatedIn` |
| `restaurantData.tableReservationProvider.*` | Metadata nha cung cap dat ban | `scrapeTableReservationProvider=true` | Co | Docs mo ta co the lay `name`, `address`, `email`, `phone`; sample co `name`, `reserveTableUrl` |
| `reserveTableUrl` | Link dat ban cua place | Co the xuat hien neu Google hien thi | Khong | Khong duoc docs danh dau la option tinh phi rieng |
| `bookingLinks[]` | Cac link booking khac | Co the xuat hien neu Google hien thi | Khong | Thuong dung voi hotel/restaurant |

## 4. Review extraction

Chi tiet review can bat `maxReviews > 0`. Docs noi ro viec nay ap dung "additional place details pricing" vi actor phai mo detail page truoc.

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `reviews[]` | Mang review chi tiet cua tung place | `maxReviews > 0` | Co | Moi place item chua toi da `5,000` reviews; hon nua se bi tach thanh nhieu item |
| `reviews[].text` | Noi dung review | `maxReviews > 0` | Co | Co the rong neu review chi danh sao |
| `reviews[].textTranslated` | Ban dich cua review | `maxReviews > 0` neu Google co | Co | Co the `null` |
| `reviews[].publishAt` | Thoi gian dang relative, vi du `a month ago` | `maxReviews > 0` | Co | String human-readable |
| `reviews[].publishedAtDate` | Thoi gian chuan hoa | `maxReviews > 0` | Co | ISO datetime |
| `reviews[].likesCount` | So luot like cua review | `maxReviews > 0` | Co | Integer |
| `reviews[].reviewId` | ID cua review | `maxReviews > 0` | Co | Luon co theo docs |
| `reviews[].reviewUrl` | URL chi tiet review | `maxReviews > 0` | Co | |
| `reviews[].reviewOrigin` | Nguon review | `maxReviews > 0`, co the loc qua `reviewsOrigin` | Co | Gia tri vi du `Google` |
| `reviews[].stars` | So sao review | `maxReviews > 0` | Co | |
| `reviews[].rating` | Rating object/field bo sung | `maxReviews > 0` | Co | Sample de `null` |
| `reviews[].responseFromOwnerDate` | Ngay chu doanh nghiep phan hoi | `maxReviews > 0` | Co | Co the `null` |
| `reviews[].responseFromOwnerText` | Noi dung phan hoi cua chu doanh nghiep | `maxReviews > 0` | Co | Co the `null` |
| `reviews[].reviewImageUrls[]` | Anh gan voi review | `maxReviews > 0` | Co | |
| `reviews[].reviewContext` | Ngu canh/phu luc cua review | `maxReviews > 0` | Co | Object, schema co the thay doi |
| `reviews[].reviewDetailedRating` | Cham diem chi tiet theo dich vu, thuc an, khong gian... | `maxReviews > 0` | Co | Object dong |
| `reviews[].name` | Ten reviewer | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | Thuoc nhom personal data |
| `reviews[].reviewerId` | ID reviewer | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | `reviewId` van co ngay ca khi tat personal data |
| `reviews[].reviewerUrl` | URL profile reviewer | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | |
| `reviews[].reviewerPhotoUrl` | Anh dai dien reviewer | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | |
| `reviews[].reviewerNumberOfReviews` | Tong so review cua reviewer | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | |
| `reviews[].isLocalGuide` | Reviewer co phai Local Guide khong | `maxReviews > 0` va `scrapeReviewsPersonalData=true` | Gian tiep | |

### Input lien quan den review

- `reviewsStartDate`: chi lay review sau moc thoi gian chi dinh; neu dung field nay, `reviewsSort` phai la `newest`.
- `reviewsSort`: `newest`, `mostRelevant`, `highestRanking`, `lowestRanking`.
- `reviewsFilterString`: loc review chua tu khoa.
- `reviewsOrigin`: `all` hoac `google`.
- `scrapeReviewsPersonalData`: bat/tat du lieu personal cua reviewer.

## 5. Image extraction

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `images[]` | Danh sach anh bo sung cua place | `maxImages > 0` | Co | Docs noi additional place details pricing ap dung |
| `images[].imageUrl` | URL tung anh | `maxImages > 0` | Co | |
| `images[].uploadedAt` | Thoi diem anh duoc upload | `maxImages > 0` neu co | Co | Co the `null` |
| `imageUrls[]` | Mang URL anh rut gon | `maxImages > 0` | Co | Huu ich cho export nhanh |
| `images[].authorName` | Ten tac gia anh | `maxImages > 0` va `scrapeImageAuthors=true` | Gian tiep | Docs khong danh dau `scrapeImageAuthors` la `($)` rieng |
| `images[].authorUrl` | URL profile tac gia anh | `maxImages > 0` va `scrapeImageAuthors=true` | Gian tiep | Yeu cau fetch them, co the lam cham |

## 6. Company contacts enrichment

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `facebooks[]` | URL Facebook tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | Sample output co field nay |
| `instagrams[]` | URL Instagram tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| `linkedIns[]` | URL LinkedIn tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| `youtubes[]` | URL YouTube tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| `tiktoks[]` | URL TikTok tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| `twitters[]` | URL Twitter/X tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| `pinterests[]` | URL Pinterest tim thay tu website doanh nghiep | `scrapeContacts=true` | Co | |
| Email/phone tu website | Email va so dien thoai bo sung lay tu website doanh nghiep | `scrapeContacts=true` | Co | Docs co mo ta co, nhung sample field name khong day du |

Ghi chu:

- Add-on nay bi gioi han voi mot so large chain theo docs.
- Docs mo ta pricing phu thuoc subscription tier.

## 7. Social media profile enrichment

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| Social profile metadata | Metadata public cua tung profile social da tim thay | `scrapeSocialMediaProfiles.{platform}=true` | Co | Docs nhac toi `profile name`, `follower counts`, `descriptions`, `post/video counts`, `verification status` |

Ghi chu:

- Bat option nay se tu dong bat `scrapeContacts`.
- Billing tinh theo tong so profile duoc enrich, khong phai theo so platform duoc chon.
- Schema chi tiet cua social profile output khong duoc sample day du trong docs hien tai.

## 8. Business leads enrichment

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `personId` | ID cua lead/nguoi lien he | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `firstName`, `lastName`, `fullName` | Ten cua lead | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `linkedinProfile` | URL LinkedIn ca nhan | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `email`, `mobileNumber` | Email va so di dong cua lead | `maximumLeadsEnrichmentRecords > 0` | Co | Co the `null` |
| `headline`, `jobTitle` | Tieu de nghe nghiep va chuc danh | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `department`, `seniority` | Phong ban va cap do seniority | `maximumLeadsEnrichmentRecords > 0` | Co | `leadsEnrichmentDepartments` giup loc dau vao |
| `industry` | Nganh nghe | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `photoUrl` | Anh dai dien cua lead | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `country`, `city`, `state` | Dia ly cua lead | `maximumLeadsEnrichmentRecords > 0` | Co | Sample co field level ca nhan |
| `companyId`, `companyName`, `companyWebsite`, `companyLinkedin` | Thong tin cong ty cua lead | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `companySize` | Quy mo cong ty | `maximumLeadsEnrichmentRecords > 0` | Co | |
| `companyCity`, `companyState`, `companyCountry` | Dia ly cong ty | `maximumLeadsEnrichmentRecords > 0` | Co | Co the `null` |
| `companyPhoneNumber` | So dien thoai cong ty | `maximumLeadsEnrichmentRecords > 0` | Co | Co the `null` |
| `twitter` | Twitter/X lien quan den cong ty hoac lead | `maximumLeadsEnrichmentRecords > 0` | Co | Sample co field nay |

Ghi chu:

- `0` nghia la tat lead enrichment.
- Phi chi tinh tren lead tim thay thanh cong.
- Add-on nay co the cham va co rui ro lien quan toi personal data/GDPR.

## 9. External places / hotel / restaurant specifics

| Field name | Y nghia | Can bat option nao | Co mat phi khong | Ghi chu |
| --- | --- | --- | --- | --- |
| `isExternalServicePlace` | Danh dau day la external service place, khong phai pin map thong thuong | Khong can | Khong | Thuong gap voi hotel |
| `externalServiceProvider` | Ten provider ben thu ba | Khong can | Khong | Vi du `SuperTravel` |
| `externalId` | ID ben ngoai cua place | Khong can | Khong | |
| `restaurantData` | Object du lieu chuyen biet cho restaurant | Co the can detail page hoac reservation provider | Gian tiep | Sample co `tableReservationProvider` |
| `tableReservationProvider.name` | Ten nha cung cap dat ban | `scrapeTableReservationProvider=true` | Co | Vi du `Resy` |
| `tableReservationProvider.reserveTableUrl` | Link dat ban cua nha cung cap | `scrapeTableReservationProvider=true` | Co | Sample co field nay |

## 10. Output view can luu y khi thiet ke API

- Standard dataset item: 1 item ~ 1 place, nhung neu place co hon `5,000` reviews thi dataset co the lap lai cung 1 place tren nhieu item.
- Reviews view: co the export moi review thanh 1 dong qua `&view=reviews`.
- Leads enrichment view: moi lead co the duoc trai ra thanh 1 dong rieng.
- Social profiles view: output enrich social profile nam o view rieng.

## 11. Truong hop docs co nhac ten field nhung chua co schema day du

Nhung field duoi day duoc docs nhac toi, nhung docs hien tai khong dua sample object day du:

- `popularTimes`
- `BusinessConfirmationText`
- `webResults[]`
- chi tiet social profile metadata sau khi enrich
- mot so field email/phone cua company contacts enrichment

Neu anh/chi muon build API response spec chat che hon, nen:

1. Chay 1-2 actor run mau voi tung option.
2. Luu raw JSON.
3. Chot schema thuc te theo du lieu tra ve, thay vi dua hoan toan tren docs mo ta.
