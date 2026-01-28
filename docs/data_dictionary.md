# Data Dictionary

**Source**: `sql/01_describe_tables.sql` executed on 2026-01-26

## Environment

| current_user | current_catalog | current_schema |
|--------------|-----------------|----------------|
| eric.case@bankrate.com | bankrate_prod | default |

---

## Table 1: bankrate_prod.br_rpt.agg_daily_v2

### Metadata
- **Type**: STREAMING_TABLE
- **Provider**: delta
- **Location**: `s3://bankrate-databricks-storage-s3bucket-prod/.../tables/agg_daily_v2`
- **Last Refreshed**: 2026-01-26T21:45:00Z
- **Owner**: 4043477746684048

### Date Column
- **searchdate** - primary date column for this table

### Columns (66 total)
| # | Column Name |
|---|-------------|
| 1 | uniqueid |
| 2 | searchdate |
| 3 | corpcompanyid |
| 4 | provider |
| 5 | campaignid |
| 6 | adgroupid |
| 7 | adid |
| 8 | averageposition |
| 9 | adgroup |
| 10 | campaign |
| 11 | keywordtext |
| 12 | tokencaret |
| 13 | tokenpound |
| 14 | tokengroup |
| 15 | clientcustomerid |
| 16 | name |
| 17 | destinationurl |
| 18 | customparameters |
| 19 | finalurl |
| 20 | keywordid |
| 21 | pid |
| 22 | externalid |
| 23 | cost |
| 24 | clickcount |
| 25 | impressioncount |
| 26 | device |
| 27 | is_sematic_data |
| 28 | domain |
| 29 | accountid |
| 30 | accountname |
| 31 | platform |
| 32 | adname |
| 33 | conversions |
| 34 | videocompletions |
| 35 | conversionvalue |
| 36 | videoviews75 |
| 37 | channel |
| 38 | engagements |
| 39 | videostarts |
| 40 | continuous2secondvideoviews |
| 41 | videoviews50 |
| 42 | baseurl |
| 43 | videoviews25 |
| 44 | videoviews3second |
| 45 | utm |
| 46 | utm_bucket |
| 47 | utm_mt |
| 48 | utm_content |
| 49 | utm_campaign |
| 50 | utm_plcmnttgt |
| 51 | utm_plcmnt |
| 52 | utm_medium |
| 53 | utm_kwdid |
| 54 | utm_referrer |
| 55 | utm_adgid |
| 56 | utm_source |
| 57 | utm_ntwk |
| 58 | utm_dvc |
| 59 | utm_adid |
| 60 | utm_term |
| 61 | utm_devicemdl |
| 62 | utm_cmpid |
| 63 | utm_googleclickid |
| 64 | utm_adpos |
| 65 | utm_tgtid |
| 66 | (end) |

---

## Table 2: bankrate_prod.br_rpt.clicksanalytics_v2

### Metadata
- **Type**: STREAMING_TABLE
- **Provider**: delta
- **Location**: `s3://bankrate-databricks-storage-s3bucket-prod/.../tables/clicksanalytics_v2`
- **Last Refreshed**: 2026-01-26T21:28:03Z
- **Owner**: 4043477746684048

### Candidate Date Columns (from SHOW COLUMNS output)
- **render_date** - appears in column list

### Columns (256 total)
| # | Column Name |
|---|-------------|
| 1 | advertisername |
| 2 | brm_hlink_param |
| 3 | brm_lead_id |
| 4 | brm_sponsor |
| 5 | isassigned |
| 6 | assigned_clicks_update_ts |
| 7 | adv_uid |
| 8 | web |
| 9 | brm_uid |
| 10 | dest_url |
| 11 | ref_url |
| 12 | ref_url_clean |
| 13 | ref_url_isbr_flag |
| 14 | ref_url_issem_flag |
| 15 | ref_url_ispartner_flag |
| 16 | render_date |
| 17 | position |
| 18 | loan_amount |
| 19 | propertyvalue |
| 20 | ext_id |
| 21 | impressionid |
| 22 | visitorid |
| 23 | ref_url_header |
| 24 | ref_url_header_clean |
| 25 | bcpc_cp_uid |
| 26 | brm_v_code_uid |
| 27 | v_code_uid |
| 28 | v_date |
| 29 | brm_v_date |
| 30 | notes |
| 31 | status_ind_uid |
| 32 | status_date |
| 33 | pagetype |
| 34 | bid_uid |
| 35 | ec_id |
| 36 | ef_id |
| 37 | fico |
| 38 | ic_id |
| 39 | local |
| 40 | msa |
| 41 | pctdown |
| 42 | points |
| 43 | ttcid |
| 44 | zip |
| 45 | requestid |
| 46 | adsetid |
| 47 | campaignid |
| 48 | clickevent_update_ts |
| 49 | affiliateid |
| 50 | bd_implimentationtype |
| 51 | bd_intergration_unit |
| 52 | bd_rtversion |
| 53 | brnetworksotgroup |
| 54 | revenuesource |
| 55 | businessunit |
| 56 | buyer |
| 57 | clickraterefby |
| 58 | clickraterefby_home |
| 59 | clickraterefby_life |
| 60 | cpcrevshare |
| 61 | departmentname |
| 62 | displayrevshare |
| 63 | email |
| 64 | insuremerefby |
| 65 | monetizationstrategy |
| 66 | opscpcsotgroup |
| 67 | opssotgroup |
| 68 | cobrandpagetype |
| 69 | pm_campaign |
| 70 | pm_strategy |
| 71 | siteurl |
| 72 | subaccount |
| 73 | vendor |
| 74 | cobrandid |
| 75 | cobrandname |
| 76 | context |
| 77 | description |
| 78 | click_type_name |
| 79 | parent |
| 80 | type |
| 81 | date |
| 82 | day |
| 83 | dayofweek |
| 84 | dayofyear |
| 85 | daysuffix |
| 86 | dowinmonth |
| 87 | holidaytext |
| 88 | dateid |
| 89 | month |
| 90 | monthname |
| 91 | quarter |
| 92 | quartername |
| 93 | standarddate |
| 94 | weekofmonth |
| 95 | weekofyear |
| 96 | year |
| 97 | market_name |
| 98 | region_name |
| 99 | state |
| 100 | utm_matched |
| 101 | utm_param |
| 102 | postlead_sentat |
| 103 | matched |
| 104 | matched_pixels_update_ts |
| 105 | productcategoryname |
| 106 | conforming |
| 107 | jumbo_prod |
| 108 | prod_type_uid |
| 109 | productname |
| 110 | prod_type_name |
| 111 | status_indicator_name |
| 112 | bidvalue |
| 113 | devicetype |
| 114 | hardwarename |
| 115 | issmartphone |
| 116 | validation_codes_name |
| 117 | _update_timestamp |
| 118 | matched_pixels_update_ts_est |
| 119 | leadgroupid |
| 120 | leads_sold |
| 121 | leadisprimary |
| 122 | ul |
| 123 | pl |
| 124 | statefullname |
| 125 | bankratescore |
| 126 | browsername |
| 127 | browserversion |
| 128 | deposits_csm |
| 129 | hardwarevendor |
| 130 | mortgage_csm |
| 131 | oem |
| 132 | pidaccount |
| 133 | pidprovider |
| 134 | platformname |
| 135 | platformversion |
| 136 | useragentstring |
| 137 | pidx |
| 138 | traffictype |
| 139 | utm_channel |
| 140 | utm_campaign |
| 141 | utm_source |
| 142 | utm_content |
| 143 | utm_medium |
| 144 | utm_adid |
| 145 | utm_bucket |
| 146 | pid |
| 147 | utm_adpos |
| 148 | utm_devicemdl |
| 149 | utm_dvc |
| 150 | utm_mt |
| 151 | utm_ntwk |
| 152 | utm_plcmnt |
| 153 | utm_plcmnttgt |
| 154 | utm_tgtid |
| 155 | utm_kwdid |
| 156 | utm_referrer |
| 157 | ttclid |
| 158 | user_id |
| 159 | gclid |
| 160 | msclkid |
| 161 | adgroupid |
| 162 | form_name |
| 163 | callernumber |
| 164 | duration |
| 165 | externalcallid |
| 166 | ispeaktime |
| 167 | leaseadvertiserid |
| 168 | leasedestinationnumber |
| 169 | leaseid |
| 170 | leasename |
| 171 | leasepoolid |
| 172 | leasevertical |
| 173 | numbercalled |
| 174 | outcome |
| 175 | pl_lender_id |
| 176 | pl_product_id |
| 177 | utm_cmpid |
| 178 | utm_keywordid |
| 179 | utm_term |
| 180 | browservendor |
| 181 | hardwaremodel |
| 182 | iscrawler |
| 183 | platformvendor |
| 184 | adset |
| 185 | menuselections |
| 186 | apr |
| 187 | tr_points |
| 188 | ep_is_bankrate_select |
| 189 | fiveycol |
| 190 | eightycol |
| 191 | totalfees |
| 192 | reqfees |
| 193 | location |
| 194 | is_consumerchoice |
| 195 | consumerchoice_type |
| 196 | outcome_time |
| 197 | dv_dclid |
| 198 | dv_advertiser_id |
| 199 | dv_creative_id |
| 200 | dv_auction_id |
| 201 | dv_insertion_order_id |
| 202 | dv_line_item_id |
| 203 | dv_exchange_id |
| 204 | dv_app_url_id |
| 205 | social_placement |
| 206 | social_adset_id |
| 207 | pl_form_submit_date |
| 208 | fbclid |
| 209 | clkid |
| 210 | re_estimated_rev |
| 211 | cashout |
| 212 | apy |
| 213 | uniqueRateTableLenderCount |
| 214 | priceable_market_name |
| 215 | priceable_market_state_abbr |
| 216 | product_id |
| 217 | product_name |
| 218 | product_is_fha |
| 219 | product_points_band |
| 220 | is_pl_form_submit |
| 221 | pl_estimated_rev |
| 222 | predict_proba |
| 223 | predicted_revenue |
| 224 | pl_total_forecast |
| 225 | is_predicted_revenue |
| 226 | adsettypeid |
| 227 | is_valid |
| 228 | is_transaction |
| 229 | datasource |
| 230 | creditscore |
| 231 | click_type_uid |
| 232 | segment_uid |
| 233 | prod_uid |
| 234 | ip_addr |
| 235 | browser_user_agent |
| 236 | msg_date |
| 237 | insert_date |
| 238 | clicked_on_rate |
| 239 | click_date |
| 240 | market_uid |
| 241 | purchaseid |
| 242 | leadid |
| 243 | blnuserinteraction |
| 244 | partnername |
| 245 | cpc_prod_group_name_lateral_alias |
| 246 | cpc_prod_group_name |
| 247 | prod_cat_uid |
| 248 | tier_num |
| 249 | rowcounter |
| 250 | cm_env |
| 251 | click_iscpl_lateral_alias |
| 252 | click_iscpl |
| 253 | legacy_valid |
| 254 | click_uid |
| 255 | session_referral_url |
| 256 | session_id |
| 257 | anonymous_id |
| 258 | instance_id |
| 259 | traffic_source_level_one |
| 260 | traffic_source_level_two |
| 261 | traffic_source_level_three |
| 262 | lendercorrelationid |
| 263 | loan_purpose |
| 264 | cost_per_click |
| 265 | lendername |
| 266 | pl_purchase_id |
| 267 | pl_flow_type |
| 268 | device_type_grouping |
| 269 | cpl_revenue |
| 270 | cpl_leads |
| 271 | vertical_product_group |
| 272 | vertical |
| 273 | cpl_clicks |
| 274 | cpc_revenue |
| 275 | cpc_clicks |
| 276 | purchase_refi |
| 277 | calls_count |

---

## Relationships
[To be populated after further analysis]

## Data Freshness
[To be populated from `/sql/02_row_counts_last_30d.sql`]

## Known Issues
[To be populated during analysis]

## Notes
- Analysis Date: 2026-01-26
- SQL Files Used: `sql/01_describe_tables.sql`
