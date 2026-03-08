import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const memberAddresses = [
  { first_name: 'Tim', last_name: 'Wirick', phone: '+18584129797', address: '8304 W 122nd St', address_2: '', city: 'Overland Park', state: 'KS', zip: '66213' },
  { first_name: 'Evan', last_name: 'Johnson', phone: '+17012120534', address: '323 W 8th St', address_2: '514', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'RuffleZZ', last_name: 'Sen', phone: '+13146770333', address: '7575 W 106th St', address_2: 'Apt 300', city: 'Overland Park', state: 'KS', zip: '66212-5911' },
  { first_name: 'Tiffany', last_name: 'Ketterman', phone: '+14174139848', address: '106 w 11th st', address_2: 'Unit 1907', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Chuck', last_name: 'Cacioppo III', phone: '+18165912944', address: '1590 Woodbine Court', address_2: '', city: 'Liberty', state: 'MO', zip: '64068' },
  { first_name: 'Skyler', last_name: 'Aldrich', phone: '+18165298643', address: '911 Main St', address_2: 'Unit 1406', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Dell', last_name: 'Johnson', phone: '+18166162019', address: '9822 N Kentucky Ave', address_2: '', city: 'Kansas City', state: 'MO', zip: '64157-8226' },
  { first_name: 'Jay', last_name: 'Runnfeldt', phone: '+17735202277', address: '12118 Mackey St', address_2: '', city: 'Overland Park', state: 'KS', zip: '66213' },
  { first_name: 'Addy', last_name: 'Kryger', phone: '+19137872536', address: '1477 Main St Unit 1202', address_2: '', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Josue', last_name: 'Montes', phone: '+15122216944', address: '6317 Valley Rd', address_2: '', city: 'Kansas City', state: 'MO', zip: '64113' },
  { first_name: 'Mark', last_name: 'Erickson', phone: '+18167397492', address: '106 w 11st', address_2: '2107', city: 'Kansas City', state: 'Mo', zip: '64105' },
  { first_name: 'Gary', last_name: 'Lee', phone: '+18166063860', address: '723 NW 42nd St', address_2: '', city: 'Blue Springs', state: 'MO', zip: '64015' },
  { first_name: 'Keith', last_name: 'Allen', phone: '+17323196651', address: '1477 Main St', address_2: 'Unit 1810', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'John', last_name: 'Inghilterra', phone: '+18609407850', address: '5720 NE Quartz Drive', address_2: '', city: 'Lees summit', state: 'Mo', zip: '64064' },
  { first_name: 'James', last_name: 'Bunch', phone: '+19134240019', address: '50 E 13th st', address_2: '1906', city: 'Kansas City', state: 'Mo', zip: '64106' },
  { first_name: 'Brittany', last_name: 'Siler', phone: '+19134067510', address: '5724 Oak St', address_2: '', city: 'Kansas City', state: 'MO', zip: '64113' },
  { first_name: 'Tom', last_name: 'Withers', phone: '+19292560043', address: '50 E 13th St', address_2: 'Apartment 2511', city: 'Kansas City', state: 'MO', zip: '64106' },
  { first_name: 'Cord', last_name: 'Cannon', phone: '+19136341739', address: '813 NW Donovan Rd', address_2: '5211', city: 'Lees Summit', state: 'MO', zip: '64086' },
  { first_name: 'Michael', last_name: 'Martin', phone: '+18167180324', address: '10419 N Saint Clair Ave', address_2: '', city: 'Kansas City', state: 'MO', zip: '64154' },
  { first_name: 'Sierra', last_name: 'Faler', phone: '+19374790999', address: '3119 Charlotte Street', address_2: '', city: 'Kansas City', state: 'MO', zip: '' },
  { first_name: 'David', last_name: 'Barnes', phone: '+19137083074', address: '1101 Walnut St', address_2: '1504', city: 'Kansas City', state: 'MO', zip: '64106' },
  { first_name: 'Drey', last_name: 'Moss', phone: '+18167269367', address: '1008 W 10th Ave', address_2: '', city: 'Kearney', state: 'MO', zip: '64060' },
  { first_name: 'Kareem', last_name: 'Rush', phone: '+18167685636', address: '8305 NE 105th', address_2: '', city: 'Kansas City', state: 'MO', zip: '64157' },
  { first_name: 'Brian', last_name: 'Hoette', phone: '+18163770197', address: '717 Old Paint Rd', address_2: '', city: 'Raymore', state: 'MO', zip: '64083' },
  { first_name: 'Brian', last_name: 'Dercher', phone: '+19132074223', address: '802 Cedar Ridge Drive', address_2: '', city: 'Raymore', state: 'MO', zip: '64083' },
  { first_name: 'Tiara', last_name: 'Arties', phone: '+18164569877', address: '1330 Nw Tullison Rd.', address_2: '', city: 'Kansas City', state: 'MO', zip: '64116' },
  { first_name: 'Nakhi', last_name: 'Norwood', phone: '+18164239306', address: '8635 Drury Ave, Apt 3211', address_2: '', city: 'Kansas City', state: 'MO', zip: '64132' },
  { first_name: 'Patrick', last_name: 'Moodie', phone: '+17853932861', address: '9401 Indian Creek Parkway', address_2: 'Suite 750', city: 'Overland Park', state: 'Kansas', zip: '66210' },
  { first_name: 'Daniel', last_name: 'Porter', phone: '+18167776311', address: '1477 Main St unit 2502', address_2: '', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Molly', last_name: 'Robinson', phone: '+18166786749', address: '106 W 11th St', address_2: 'Appt 1605', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Michael', last_name: 'Perez', phone: '+17732555552', address: '11003 Sloan Ave', address_2: '', city: 'Kansas City', state: 'Ks', zip: '66109' },
  { first_name: 'Stacy', last_name: 'Davis', phone: '+19132726779', address: '6608 W 201st Ter', address_2: '', city: 'Bucyrus', state: 'KS', zip: '66013' },
  { first_name: 'Tamara', last_name: 'Floyd', phone: '+18167390556', address: '19800 Murphy Rd', address_2: '', city: 'Trimble', state: 'Missouri', zip: '64492' },
  { first_name: 'Jason', last_name: 'Williams', phone: '+14175922570', address: '2320 Southwest River Spring Road,', address_2: '', city: "LEE'S SUMMIT", state: 'MO', zip: '64082' },
  { first_name: 'Tony', last_name: 'Cuomo', phone: '+19133293425', address: '7826 Summit st', address_2: '', city: 'Kansas city', state: 'Missouri', zip: '64114' },
  { first_name: 'Adelina', last_name: 'Simpson', phone: '+19563342385', address: '920 Main St', address_2: '1510', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Isabelle', last_name: 'Loos', phone: '+18164160785', address: '706 NE Hamel Pl', address_2: 'Place A', city: "Lee's Summit", state: 'MO', zip: '64063' },
  { first_name: 'Travis', last_name: 'Tinker', phone: '+15733158678', address: '2985 NW 91st Terrace', address_2: '', city: 'Kansas City', state: 'Missouri', zip: '64154' },
  { first_name: 'Seongmin', last_name: 'Lee', phone: '+16364393385', address: '920 Main St', address_2: 'APT 1215', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Jason', last_name: 'Wells', phone: '+16362361223', address: '106 W 11th St', address_2: '806', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Lakeisha', last_name: 'Trimble', phone: '+16609242849', address: '12115 E 57th Terr', address_2: '', city: 'Kansas City', state: 'MO', zip: '64133' },
  { first_name: 'Mike', last_name: 'Belew', phone: '+18166458963', address: '4300 NW Old Stagecoach RD', address_2: '', city: 'Kansas city', state: 'MO', zip: '64154' },
  { first_name: 'Rodney', last_name: 'Thomas', phone: '+18166740537', address: '2946 E. 29th St', address_2: '', city: 'Kansas City', state: 'Missouri', zip: '64128' },
  { first_name: 'Rebekah', last_name: 'Schaaf', phone: '+19137077957', address: '10240 Catalina St', address_2: '', city: 'Overland Park', state: 'Kansas', zip: '66207' },
  { first_name: 'Nicole', last_name: 'Hodges', phone: '+18165291425', address: '324 NE Fiddlewood Ave', address_2: '', city: "Lee's Summit", state: 'Missouri', zip: '64086' },
  { first_name: 'Anthony', last_name: 'Valles', phone: '+18164625627', address: '9121 Western Hills Dr', address_2: '', city: 'Kansas City', state: 'MO', zip: '64114' },
  { first_name: 'Robert', last_name: 'Gibson', phone: '+12672597270', address: '3949 Dr. Martin Luther King Blvd', address_2: 'Unit 303', city: 'Kansas City', state: 'Missouri', zip: '64130' },
  { first_name: 'Molly', last_name: 'Maloney', phone: '+18167159347', address: '106 W 11th St', address_2: 'APT 1608', city: 'Kansas City', state: 'Missouri', zip: '64105' },
  { first_name: 'Sean', last_name: 'Davenport', phone: '+19139726203', address: '1129 synergy', address_2: '', city: 'Irvine', state: 'CA', zip: '92614' },
  { first_name: 'Richard', last_name: 'Alexander', phone: '+19136261875', address: '12930 Meadow Ln', address_2: '', city: 'Kansas City', state: 'KANSAS', zip: '66109' },
  { first_name: 'matt', last_name: 'gibson', phone: '+19133787150', address: '23326 South Victory Road', address_2: '', city: 'Spring Hill', state: 'KS', zip: '66083' },
  { first_name: 'Teresa', last_name: 'Cordero', phone: '+18162449286', address: '4514 NW Apache Drive', address_2: '', city: 'Riverside', state: 'MO', zip: '64150' },
  { first_name: 'Chase', last_name: 'Sanoubane', phone: '+19137498752', address: '5806 Park Cir', address_2: '', city: 'Shawnee', state: 'KS', zip: '66216' },
  { first_name: 'Shelby', last_name: 'Davis', phone: '+13148071161', address: '4265 Clark Ave', address_2: 'Apt 235', city: 'Kansas City', state: 'MO', zip: '64111' },
  { first_name: 'Sophia', last_name: 'Fike', phone: '+16184912645', address: '106 W 11th Street', address_2: 'Apt 207', city: 'Kansas City', state: 'MO', zip: '64105' },
  { first_name: 'Ariane', last_name: 'Bell', phone: '+18162692442', address: '722 Walnut St', address_2: 'apt 1112', city: 'Kansas City', state: 'Missouri', zip: '64106' },
  { first_name: 'jordan', last_name: 'richmond', phone: '+19097315934', address: '3600 broadway Blvd apt 329', address_2: '', city: 'Kansas City', state: 'missouri', zip: '64111' },
  { first_name: 'Shaktivir (Sean)', last_name: 'Manohar', phone: '+19136020890', address: '11158 S Crestone St', address_2: '', city: 'Olathe', state: 'KS', zip: '66061' },
  { first_name: 'Tony', last_name: 'Donley', phone: '+19132053586', address: '1127 E 49th ST', address_2: '', city: 'Kansas City', state: 'MO', zip: '64110' },
  { first_name: 'Eric', last_name: 'Korth', phone: '+18165208300', address: '7635 Holmes Road', address_2: '', city: 'Kansas City', state: 'MO', zip: '64131' },
  { first_name: "Verne'", last_name: 'Wright', phone: '+19132485581', address: '444 W 47th St', address_2: 'Ste 900', city: 'Kansas City', state: 'MO', zip: '64112' },
  { first_name: 'Kenya', last_name: 'Campbell', phone: '+18138246095', address: '103 s Eastglen Dr', address_2: '', city: 'Raymore', state: 'MO', zip: '64083' },
  { first_name: 'Ryan', last_name: 'Westfahl', phone: '+18166101541', address: '422 NE 103rd St', address_2: 'apt 8C', city: 'Kansas City', state: 'MO', zip: '64155' },
  { first_name: 'Amber', last_name: 'Tiberio', phone: '+19138080956', address: '5308 W 153rd St', address_2: '', city: 'Leawood', state: 'Kansas', zip: '66224' },
  { first_name: 'Kate', last_name: 'Walsworth', phone: '+19139549696', address: '5807 W 77th Terrace', address_2: '', city: 'Prairie Village', state: 'Kansas', zip: '66208' },
  { first_name: 'Jack', last_name: 'Mocherman', phone: '+15732700320', address: '5706 NW Raintree Ct', address_2: '', city: 'Parkville', state: 'MO', zip: '64152' },
  { first_name: 'Isiah', last_name: 'Bowie', phone: '+19132350974', address: '4415 Jefferson st apt 101', address_2: '', city: 'Kansas City', state: 'Mo', zip: '64111' },
  { first_name: 'DeWayne', last_name: 'Ables', phone: '+19136367373', address: '25770 W 127th street', address_2: '', city: 'Olathe', state: 'KS', zip: '66061' },
  { first_name: 'LaTasha', last_name: 'Tuggle', phone: '+19139800503', address: 'I808 N 91st St', address_2: '', city: 'Kansas City', state: 'KS', zip: '66112' },
  { first_name: 'Jennifer', last_name: 'Shreckengost', phone: '+18168720800', address: '15705 County Road RA', address_2: '', city: 'Excelsior Springs', state: 'MO', zip: '64024' },
  { first_name: 'Katie', last_name: 'Wiseman', phone: '+19139725697', address: '4519 Bell St', address_2: '', city: 'Kansas City', state: 'MO', zip: '64111' },
  { first_name: "Ka'Von", last_name: 'Johnson', phone: '+18165500268', address: '3535 Broadway Blvd', address_2: 'Apt 206', city: 'Kansas City', state: 'Missouri', zip: '64111' },
  { first_name: 'Natalie', last_name: 'Shepherd', phone: '+18166798642', address: '10708 West 128th Place', address_2: '', city: 'Overland Park', state: 'KS', zip: '66213' },
  { first_name: 'Millie', last_name: 'Freeman', phone: '+19132051209', address: '12850 S Black Bob Rd Apt 5301', address_2: '', city: 'Olathe', state: 'KS', zip: '66062' },
  { first_name: 'Nathan', last_name: 'Mundt', phone: '+19286322185', address: '5634 Holmes St', address_2: '', city: 'Kansas City', state: 'MO', zip: '64110' },
  { first_name: 'Stacy', last_name: 'Clark', phone: '+18165202934', address: '2470 NW Riverview Dr', address_2: '', city: 'Riverside', state: 'MO', zip: '64150' },
  { first_name: 'Calista', last_name: 'Bogart', phone: '+14175513311', address: '1451 NW 38th St', address_2: 'Apt 100', city: 'Kansas City', state: 'MO', zip: '64116' },
  { first_name: 'Susan', last_name: 'Stone Li', phone: '+19175159499', address: '6901 Ralston Ave', address_2: '', city: 'Raytown', state: 'MO', zip: '64133' },
  { first_name: 'Alicia', last_name: 'Reyes', phone: '+19139075709', address: '1114 S 55th Terrace', address_2: '', city: 'Kansas City', state: 'Kansas', zip: '66106' },
  { first_name: 'Sam', last_name: 'DeArmon', phone: '+14176930304', address: '9851 Sagamore Rd', address_2: '', city: 'Leawood', state: 'KS', zip: '66206' },
  { first_name: 'Whitney', last_name: 'Courser', phone: '+19137064919', address: '13104 W 127th PL', address_2: '', city: 'Overland Park', state: 'KS', zip: '66213' },
  { first_name: 'Tessa', last_name: 'Bisges', phone: '+18167779228', address: '909 Paw Paw Lane', address_2: '', city: 'Liberty', state: 'MO', zip: '64068' },
  { first_name: 'Michael', last_name: 'Garrett', phone: '+12135142771', address: '1015 W 69th St', address_2: '', city: 'Kansas City', state: 'MO', zip: '64113' },
  { first_name: 'Maria', last_name: 'Rodriguez', phone: '+19134240617', address: '1808 Broadway Blvd', address_2: '', city: 'Kansas City', state: 'MO', zip: '64106' },
  { first_name: 'Jason', last_name: 'Black', phone: '+18083970882', address: '2536 Jasu Drive', address_2: '', city: 'Lawrence', state: 'KS', zip: '66046' },
  { first_name: 'Anthony', last_name: 'Meljanac', phone: '+19134019238', address: '731 S Sycamore Street', address_2: '', city: 'Gardner', state: 'Kansas', zip: '66030' },
  { first_name: 'Amina', last_name: 'Barnes', phone: '+19136203498', address: '505 SE Carter Rd', address_2: '', city: "Lee's Summit", state: 'MO', zip: '64082' },
  { first_name: 'Jared', last_name: 'Palfreeman', phone: '+14808220894', address: '2404 Southwest 12th Terrace', address_2: '', city: "Lee's Summit", state: 'MO', zip: '64081' },
  { first_name: 'Ronny', last_name: 'Soto', phone: '+18167690491', address: '203 E 23rd Ave', address_2: 'APT 163', city: 'Kansas City', state: 'MO', zip: '64116' },
  { first_name: 'Ayham', last_name: 'Johnson', phone: '+16193769575', address: '3600 Broadway Blvd', address_2: '', city: 'Kansas City', state: 'Missouri', zip: '64111' },
  { first_name: 'Doug', last_name: 'Mottet', phone: '+18167290285', address: '6059 Southlake Drive', address_2: '', city: 'Parkville', state: 'MO', zip: '64152' },
  { first_name: 'Jeffrey', last_name: 'Weiner', phone: '+19135794291', address: '106 W 11th St', address_2: 'Apt 707', city: 'Kansas City', state: 'MO', zip: '64105-1813' },
  { first_name: 'Joseph', last_name: 'Savage', phone: '+17205195056', address: '2311 21st Ave', address_2: '1C', city: 'Astoria', state: 'NY', zip: '11105' },
  { first_name: 'Matt', last_name: 'Dodge', phone: '+19139400503', address: '6022 Belleview Ave', address_2: '', city: 'Kansas City', state: 'Missouri', zip: '64113' },
  { first_name: 'Moira', last_name: 'Molloy', phone: '+16037148710', address: '121 Delaware St', address_2: 'Unit 418', city: 'Kansas City', state: 'Missouri', zip: '64105' },
  { first_name: 'Chantelle', last_name: 'Nash', phone: '+18324917825', address: '6621 Belmont Dr', address_2: '', city: 'Shawnee', state: 'KS', zip: '66226' },
  { first_name: 'Devon', last_name: 'Hamm', phone: '+13374012140', address: '106 w 11th st', address_2: 'APT 1212', city: 'KANSAS CITY', state: 'Missouri', zip: '64105' },
  { first_name: 'Maggie', last_name: 'Norsworthy', phone: '+18168898031', address: '6605 NW Caney Creek Dr', address_2: '', city: 'Kansas City', state: 'MO', zip: '64151' },
  { first_name: 'Brock', last_name: 'Schulte', phone: '+19134619653', address: '901 McGee', address_2: 'Unit 306', city: 'Kansas City', state: 'MO', zip: '64106' },
  { first_name: 'Haven', last_name: 'Lackey', phone: '+15157458057', address: '200 E 23rd Ave', address_2: '', city: 'North Kansas City', state: 'MO', zip: '64116' },
  { first_name: 'Dillon', last_name: 'Carter', phone: '+18163250649', address: '2980 Baltimore ave', address_2: '', city: 'Kansas city', state: 'MO', zip: '64108' },
  { first_name: 'Christine', last_name: 'Nuber', phone: '+19132268770', address: '2394 W Elizabeth st', address_2: '', city: 'Olathe', state: 'Kanas', zip: '66061' },
  { first_name: 'Jesse', last_name: 'Crawford', phone: '+18166828853', address: '2634 W Mulberry St', address_2: '', city: 'Olathe', state: 'Kansas', zip: '66061' },
  { first_name: 'Carlie', last_name: 'Pratt', phone: '+13146100192', address: '2100 NW Lowenstein Dr.', address_2: 'Apt. 218', city: "Lee's Summit", state: 'MO', zip: '64081' },
  { first_name: 'Maria', last_name: 'VanWinkle', phone: '+18166741996', address: '6095 Timberidge', address_2: '', city: 'Parkville', state: 'MO', zip: '64152' },
  { first_name: 'Laurie', last_name: 'Fisher', phone: '+19135485120', address: '4805 SW 3rd St', address_2: '', city: 'Blue Springs', state: 'MO', zip: '64104' },
  { first_name: 'Brendan', last_name: 'Tener', phone: '+19132448359', address: '1477 Main St.', address_2: '2209', city: 'Kansas City', state: 'Missouri', zip: '64105' },
  { first_name: 'Kent', last_name: 'Ingram', phone: '+16613782192', address: '2101 NE 60th Terr', address_2: '', city: 'Kansas City', state: 'MO', zip: '64118' },
  { first_name: 'Cheryl', last_name: 'Mayfield', phone: '+15754306136', address: '8942 Rene St', address_2: '', city: 'Lenexa', state: 'KS', zip: '66215' },
  { first_name: 'Maria', last_name: 'Urban', phone: '+17858405082', address: '621 East 110th Terrace', address_2: '', city: 'Kansas City', state: 'MO', zip: '64131-4011' },
  { first_name: 'Tyson', last_name: 'Marrs', phone: '+19132194165', address: '10511 W 140th Terr', address_2: '', city: 'Overland Park', state: 'KS', zip: '66221' },
  { first_name: 'LaShonda', last_name: 'Wesley', phone: '+18164334894', address: '3631 S EMERY ST', address_2: '', city: 'INDEPENDENCE', state: 'MO', zip: '64055' },
  { first_name: 'Jessica', last_name: 'Balick', phone: '+17735756385', address: '9111 Wornall Road', address_2: '', city: 'Kansas City', state: 'MO', zip: '64114' },
  { first_name: 'Drew', last_name: 'Davisson', phone: '+19137080420', address: '13853 S. Gallery St.', address_2: '', city: 'Olathe', state: 'Kansas', zip: '66062' },
  { first_name: 'Keaira', last_name: 'Emery', phone: '+18168264425', address: '330 NE 94th St', address_2: '332', city: 'Kansas city', state: 'Mo', zip: '64155' },
  { first_name: 'Roxsen', last_name: 'Koch', phone: '+18163057792', address: '6115 Westwood Ct', address_2: '', city: 'Parkville', state: 'MO', zip: '64152' },
  { first_name: 'Andrew', last_name: 'Worthington', phone: '+16605251230', address: '4741 Larkspur Cir', address_2: '', city: 'Lawrence', state: 'Kansas', zip: '66047' },
  { first_name: 'Michael', last_name: 'Nguyen', phone: '+19132184548', address: '601 Avenida Cesar Chavez', address_2: '208', city: 'Kansas City', state: 'Missouri', zip: '64108' },
  { first_name: 'Eryn', last_name: 'Davis-Hayter', phone: '+18165880144', address: '11405 Parallel Pkwy', address_2: 'Apt 2419', city: 'Kansas City', state: 'Kansas', zip: '66109' },
];

async function updateMemberAddresses() {
  let successCount = 0;
  let failureCount = 0;
  let notFoundCount = 0;

  for (const memberData of memberAddresses) {
    try {
      // Find member by phone number
      const { data: members, error: findError } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, phone')
        .eq('phone', memberData.phone);

      if (findError) {
        console.error(`Error finding member ${memberData.first_name} ${memberData.last_name}:`, findError);
        failureCount++;
        continue;
      }

      if (!members || members.length === 0) {
        console.log(`Member not found: ${memberData.first_name} ${memberData.last_name} (${memberData.phone})`);
        notFoundCount++;
        continue;
      }

      // Combine address and address_2 if both exist
      const fullAddress = memberData.address_2
        ? `${memberData.address} ${memberData.address_2}`
        : memberData.address;

      // Update all matching members (in case of duplicates)
      for (const member of members) {
        const { error: updateError } = await supabase
          .from('members')
          .update({
            address: fullAddress,
            city: memberData.city,
            state: memberData.state.toUpperCase(),
            zip_code: memberData.zip
          })
          .eq('member_id', member.member_id);

        if (updateError) {
          console.error(`Error updating member ${member.first_name} ${member.last_name}:`, updateError);
          failureCount++;
        } else {
          console.log(`✓ Updated: ${member.first_name} ${member.last_name} - ${fullAddress}, ${memberData.city}, ${memberData.state} ${memberData.zip}`);
          successCount++;
        }
      }
    } catch (error) {
      console.error(`Unexpected error processing ${memberData.first_name} ${memberData.last_name}:`, error);
      failureCount++;
    }
  }

  console.log('\n=== Update Summary ===');
  console.log(`✓ Successfully updated: ${successCount}`);
  console.log(`✗ Failed: ${failureCount}`);
  console.log(`? Not found: ${notFoundCount}`);
  console.log(`Total processed: ${memberAddresses.length}`);
}

updateMemberAddresses();
