// Get current local datetime in "YYYY-MM-DD HH:MM:SS" format
export function getNowLocal() {
  const now = new Date();
  return now.toLocaleString("sv-SE", {timeZone: "America/New_York"}).replace("T", " ");
}

export const CLUBS = {
  "6517": { name: "Beavercreek" },
  "6380": { name: "North Dayton" },
  "8136": { name: "South Dayton" }
};

export const GASBUDDY_STATIONS = {
  "001": { "name": "Sunoco", "address": "1726 S Broadway St, Dayton, OH" },
  "002": { "name": "QuikTrip", "address": "2121 S Edwin C Moses Blvd, Dayton, OH" },
  "003": { "name": "Love's Travel Stop", "address": "2217 S Edwin C Moses Blvd, Dayton, OH"},
  "004": { "name": "BP", "address": "2100 S Edwin C Moses Blvd, Dayton, OH" },
  "005": { "name": "Speedway", "address": "3901 N Dixie Dr, Dayton, OH" },
  "006": { "name": "QuikTrip", "address": "2301 Wagner Ford Rd, Dayton, OH" },
  "007": { "name": "Marathon", "address": "119 N James H McGee Blvd, Dayton, OH" },
  "008": { "name": "OM Oil", "address": "3420 Needmore Rd, Dayton, OH" },
  "009": { "name": "Marathon", "address": "4351 Riverside Dr, Dayton, OH" },
  "010": { "name": "United Dairy Farmers", "address": "3026 Harshman Rd, Dayton, OH" },
  "011": { "name": "Shell", "address": "1951 Stanley Ave, Dayton, OH" },
  "012": { "name": "BP", "address": "3636 GERMANTOWN ST, Dayton, OH" },
  "013": { "name": "Marathon", "address": "2250 Wagoner Ford Rd, Dayton, OH" },
  "014": { "name": "Starfire", "address": "3499 W Siebenthaler Ave, Dayton, OH" },
  "015": { "name": "Shell", "address": "1224 S Main St, Dayton, OH" },
  "016": { "name": "BP", "address": "433 S MAIN ST, Dayton, OH" },
  "017": { "name": "BP", "address": "500 SALEM AVE, Dayton, OH" },
  "018": { "name": "Valero", "address": "2800 Philadelphia Dr, Dayton, OH" },
  "019": { "name": "Sheetz", "address": "4840 Needmore Rd, Dayton, OH" },
  "020": { "name": "Clark", "address": "3406 E Third St, Dayton, OH" },
  "021": { "name": "Shell", "address": "4125 W 3rd St, Dayton, OH" },
  "022": { "name": "OM Oil", "address": "5435 N Dixie Dr, Dayton, OH" },
  "023": { "name": "United Dairy Farmers", "address": "1943 E Siebenthaler Ave, Dayton, OH" },
  "024": { "name": "Shell", "address": "3707 Germantown St, Dayton, OH" },
  "025": { "name": "Sunoco", "address": "912 Wayne Ave, Dayton, OH" },
  "026": { "name": "United Dairy Farmers", "address": "1217 Brown St, Dayton, OH" },
  "027": { "name": "Sunoco", "address": "1502 Wayne Ave, Dayton, OH" },
  "028": { "name": "Kroger", "address": "4506 Brandt Pike, Huber Heights, OH" },
  "029": { "name": "Sunoco", "address": "3445 Linden Ave, Dayton, OH" },
  "030": { "name": "Sammy's", "address": "2426 S Smithville Rd, Dayton, OH" },
  "031": { "name": "Marathon", "address": "3905 N Main St, Dayton, OH" },
  "032": { "name": "United Dairy Farmers", "address": "1666 Woodman Dr, Dayton, OH" },
  "033": { "name": "BP", "address": "4024 W 3RD ST, Dayton, OH" },
  "034": { "name": "Speedway", "address": "1556 Huffman Ave, Dayton, OH" },
  "035": { "name": "Shell", "address": "4046 Free Pike, Dayton, OH" },
  "036": { "name": "Speedway", "address": "121 E Stewart St, Dayton, OH" },
  "037": { "name": "Marathon", "address": "527 S Smithville Rd, Dayton, OH" },
  "038": { "name": "Keowee Fuel Services", "address": "1535 N Keowee St, Dayton, OH" },
  "039": { "name": "Marathon", "address": "201 Valley St, Dayton, OH" }
};