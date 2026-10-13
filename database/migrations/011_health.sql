-- Health observations and the disease knowledge base.
-- Text is the PDF text layer. Marathi vowel signs in these files are incomplete.
-- Nothing here is approved. No dose was reconstructed.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000126', 'health.read', 'View the knowledge base, observations, and biosecurity steps'),
  ('00000000-0000-4000-8000-000000000127', 'health.record', 'Record a health observation or an owner-written biosecurity step'),
  ('00000000-0000-4000-8000-000000000128', 'health.approve', 'Approve a knowledge entry or a copied biosecurity step'),
  ('00000000-0000-4000-8000-000000000129', 'health.treat', 'Record that a medicine was given, after an entry is approved');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('health.read', 'health.record', 'health.approve', 'health.treat'))
  OR (r.code = 'manager' AND p.code IN ('health.read', 'health.record', 'health.approve', 'health.treat'))
  OR (r.code = 'worker' AND p.code IN ('health.read', 'health.record'))
  OR (r.code = 'vet_advisor' AND p.code IN ('health.read', 'health.record'))
);

CREATE TABLE knowledge_entries (
  id CHAR(36) NOT NULL,
  source_file VARCHAR(180) NOT NULL,
  source_page INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  text_layer TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_knowledge_page (source_file, source_page),
  CONSTRAINT chk_knowledge_page CHECK (source_page >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_approvals (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  entry_id CHAR(36) NOT NULL,
  approved TINYINT(1) NOT NULL DEFAULT 0,
  verification_note VARCHAR(1000) NULL,
  updated_by CHAR(36) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_knowledge_approval (farm_id, entry_id),
  CONSTRAINT fk_knowledge_approval_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_knowledge_approval_entry FOREIGN KEY (entry_id) REFERENCES knowledge_entries (id),
  CONSTRAINT fk_knowledge_approval_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE health_observations (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  observed_on DATE NOT NULL,
  batch_id CHAR(36) NULL,
  bird_count INT NULL,
  notes VARCHAR(1000) NOT NULL,
  entry_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_health_obs_farm (farm_id, observed_on),
  CONSTRAINT chk_health_birds CHECK (bird_count IS NULL OR bird_count >= 0),
  CONSTRAINT fk_health_obs_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_health_obs_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_health_obs_entry FOREIGN KEY (entry_id) REFERENCES knowledge_entries (id),
  CONSTRAINT fk_health_obs_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE medicine_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  entry_id CHAR(36) NOT NULL,
  given_on DATE NOT NULL,
  batch_id CHAR(36) NULL,
  notes VARCHAR(1000) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_medicine_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_medicine_entry FOREIGN KEY (entry_id) REFERENCES knowledge_entries (id),
  CONSTRAINT fk_medicine_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_medicine_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE biosecurity_steps (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  origin ENUM('owner', 'pdf') NOT NULL,
  source_file VARCHAR(180) NULL,
  source_page INT NULL,
  approved TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_biosecurity_source CHECK (
    (origin = 'owner' AND source_file IS NULL AND source_page IS NULL)
    OR (origin = 'pdf' AND source_file IS NOT NULL AND source_page IS NOT NULL)
  ),
  CONSTRAINT fk_biosecurity_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_biosecurity_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO knowledge_entries (id, source_file, source_page, title, text_layer) VALUES
  ('ba5341fb-a9de-5168-95ac-1a3baaabf222', 'patil-poultry-step-by-step-process.pdf', 1, 'STEP 1', 'STEP BY STEP PROCESS
Patil Poultry House Training
STEP 1
STEP 2'),
  ('b12fdbb1-1641-5f41-87fa-63f84017e45b', 'patil-poultry-step-by-step-process.pdf', 2, 'STEP 3', 'STEP BY STEP PROCESS
Patil Poultry House Training
STEP 3
STEP 4'),
  ('9def6dce-2909-5d71-862a-c4d5bc5dd91e', 'patil-poultry-step-by-step-process.pdf', 3, '• पपल्ट्लांच्या आर्गमनाच्या 10 ते 15 हदवस आधी शेर् चांर्गले स्वच्छ करा.', '• पपल्ट्लांच्या आर्गमनाच्या 10 ते 15 हदवस आधी शेर् चांर्गले स्वच्छ करा.
• सवद प्रथम कोळीच्या जाळ्या काढा आणण नंतर फ्लोर / तळाशी साफसफाई
करा.
• नंतर फरशी पूणदपणे धुवा आणण मर्ग फरशीवर व भीतीवर चुनार्शंपर्ा.
• त्यानंतर, शेर्च्या बािेर आणण आत फॉमोलीन ककंवा कसोलीन (Virback)
ककंवा दुसऱ्या कोणत्या चांर्गल्ट्या जंतुनाशकची 3 हदवसांच्या अंतराने 2
वेळा फवारणी करा आणण दोनिी जाळीच्या बाजूने पर्दे कव्िर करा.
जेणेककेन जंतुनाशक प्रभावीपणे शेर्चे पूणदपणे िनजंतुकीकरण कके शकेल.
Patil Poultry House Training'),
  ('264f6e79-e44c-5dfc-aadb-77a1b86095c5', 'patil-poultry-step-by-step-process.pdf', 4, 'पपल्ट्ली िाणायच्या १ हदवस पाहिलेची तयारी', 'पपल्ट्ली िाणायच्या १ हदवस पाहिलेची तयारी
Patil Poultry House Training
STEP 1'),
  ('1f3de4ff-67fd-56d5-a386-a4c0024e5bf8', 'patil-poultry-step-by-step-process.pdf', 5, 'STEP 2', 'Patil Poultry House Training
STEP 2'),
  ('0520c159-c4d4-594e-bfea-a8005a514336', 'patil-poultry-step-by-step-process.pdf', 6, 'STEP 3', 'Patil Poultry House Training
STEP 3'),
  ('b04450db-8d91-57ac-9758-cc5ad3134718', 'patil-poultry-step-by-step-process.pdf', 7, 'STEP 4 – Gul पाणी', 'Patil Poultry House Training
STEP 4 – Gul पाणी'),
  ('9ca56e62-1eab-594d-a9de-00545a2d6652', 'patil-poultry-step-by-step-process.pdf', 8, 'BRODING (ब्रॉडर्ंर्ग) मांजे काय? + TEMPERATURE', 'BRODING (ब्रॉडर्ंर्ग) मांजे काय? + TEMPERATURE
ककती पाहिजे ?
Patil Poultry House Training'),
  ('2ab2f204-b165-5f92-b200-1c0c7e97a244', 'patil-poultry-step-by-step-process.pdf', 9, 'Page 9', 'Patil Poultry House Training'),
  ('79206bba-fee9-5f24-bfba-195884007874', 'patil-poultry-step-by-step-process.pdf', 10, 'TYPES OF BROODING!!', 'TYPES OF BROODING!!
Patil Poultry House Training
Bulb
Brooding
200 wt BULB
Led BULB
500 wt
halogen'),
  ('052e18ae-86c1-5cc8-acbc-675052ca3087', 'patil-poultry-step-by-step-process.pdf', 11, 'Gas Brooding', 'Patil Poultry House Training
Gas Brooding'),
  ('c1c19273-c2e9-515b-8087-3385b910bcc7', 'patil-poultry-step-by-step-process.pdf', 12, 'Coal Brooding', 'Patil Poultry House Training
Coal Brooding'),
  ('357755d2-8c55-5aea-8e3d-5e6a731ea051', 'patil-poultry-step-by-step-process.pdf', 13, 'THINGS REQUIRED IN BROODING', 'THINGS REQUIRED IN BROODING
Patil Poultry House Training'),
  ('745c37d7-0388-5e16-b893-2c9cb42f3d01', 'patil-poultry-step-by-step-process.pdf', 14, 'Page 14', 'Patil Poultry House Training'),
  ('7a4acae3-683d-5078-aaff-fb71a9f9d9b5', 'patil-poultry-step-by-step-process.pdf', 15, 'HOW TO KNOW IF YOUR BROODING IS PROPER', 'HOW TO KNOW IF YOUR BROODING IS PROPER
?
Patil Poultry House Training'),
  ('eeacdad9-8a5d-52ec-a003-d8c4226fa4c8', 'patil-poultry-step-by-step-process.pdf', 16, 'HENS SPACE MANAGEMENT', 'HENS SPACE MANAGEMENT
• 1 te 15 Diwas: 0.25 te 0.30 square foot prati pilla.
• 15 Diwas te 1 Mahina: 0.50 te 0.75 square foot prati pilla.
• 1 Mahina te 3 Mahine: 1.0 te 1.5 square foot prati pilla.
• 3 Mahine te 6 Mahine: 1.5 te 2.0 square foot prati pilla.
• 6 Mahine + (Layer Hen): 2.0 te 2.5 square foot prati kombadi.
Patil Poultry House Training'),
  ('6b84560e-e265-5f01-b4a8-524aab32d20d', 'patil-poultry-step-by-step-process.pdf', 17, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
Day 1,2,3 (सकाळ)
१००पक्षाााांसाठी, 1 मलटरपाण्यात1 gm
इलेक्रोलाइट
पावडर+ 1 mL vinegar
4 litre
पाण्यात1 टॅब्लेटLimcee
व्व्हटॅममनसी+ 1 टॅब्लेटb-complex
Day 1,2,3(साांध्याकाळ)'),
  ('fdfaf667-0546-5abd-a8c7-cd2dc29eec3d', 'patil-poultry-step-by-step-process.pdf', 18, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
1 Lt पाण्यात 1 mL vimeral or multistar
Day 4,5 (सकाळ)
DAY 4,5(साांध्याकाळ)
१मलटरपाण्यात१ममलीएनरोमसन'),
  ('dbe88c53-a9cd-5957-afa1-af1e734c90a9', 'patil-poultry-step-by-step-process.pdf', 19, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
DAY 6 (लासोटालस)'),
  ('10983570-c5a7-59f6-a113-2f15947dc428', 'patil-poultry-step-by-step-process.pdf', 20, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
1 lit पाण्यात, 1 mL Brotone liver
tonic
Day 7,8,9 (सकाळ)
१मलटरपाण्यात०.५गोळी
Limcee tablet
Day 7,8,9 (सांद्याकाळ)'),
  ('27355687-bc5e-5708-beb6-82a7ecc9a954', 'patil-poultry-step-by-step-process.pdf', 21, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
1 lit पाण्यात, 1 mL Vimeral
DAY 10,11 (पूर्ण दिवस  )'),
  ('701a09b4-2404-5575-8bed-630624ab4f4d', 'patil-poultry-step-by-step-process.pdf', 22, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
1 lit पाण्यात, 2 gm ecare se
१मलटरपाण्यात१ममलीToxol
Day 12,13 (सकाळ)
Day 12,13 (सांद्याकाळ)'),
  ('6ac99059-1631-5320-ba07-8237b52ab6b8', 'patil-poultry-step-by-step-process.pdf', 23, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
DAY 1 4 (ग ांबोरो लस)'),
  ('bf773df1-18d6-5580-b623-3251ee4d2a96', 'patil-poultry-step-by-step-process.pdf', 24, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
Day 15,16,17 ( पूर्ण  दिवस   )
१lit water , १
mL Encorin - Bh'),
  ('21457340-b36b-5d34-8b64-7cc4c9e44a50', 'patil-poultry-step-by-step-process.pdf', 25, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
1 lit पाण्यात, 2 ml Brotone liver
tonic
१lit पाण्यात,   २ml Toxol
Day 18,19,20 (सकाळ)
Day 18,19,20 (सांद्याकाळ)'),
  ('4c1cd1c6-4a0f-5d34-9a56-6f18b4d2885d', 'patil-poultry-step-by-step-process.pdf', 26, '1 – 21CHICKS MEDICINE SCHEDULE', '1 – 21CHICKS MEDICINE SCHEDULE
Patil Poultry House Training
DAY 2 1 (LASOTA लस)'),
  ('11ae3ab5-16cb-50c2-b676-4efe1a88a127', 'patil-poultry-step-by-step-process.pdf', 27, 'पपल्ट्ल्ट्यांची लिस्सलारान SCHEDULE', 'पपल्ट्ल्ट्यांची लिस्सलारान SCHEDULE
1. १ ददवस: ०.२ र्मली मारेक्स (1 Divas: 0.2 ml Marek’s)
2. ६ ददवस: लासोटा एक थेंब र्ोळ्यात ककंवा नाकात (6 Divas: Lasota - one drop in eye or nose)
3. १४ ददवस: र्गॅम्बोरो एक थेंब र्ोळ्यात ककंवा नाकात (14 Divas: Gumboro - one drop in eye or nose)
4. २१ ददवस: लासोटा बूस्टर र्ोस (एक थेंब र्ोळ्यात ककंवा नाकात) (21 Divas: Lasota booster dose -
one drop in eye or nose)
5. २८ ददवस: र्गॅम्बोरो बूस्टर र्ोस (एक थेंब र्ोळ्यात ककंवा नाकात) (28 Divas: Gumboro booster dose -
one drop in eye or nose)
6. ४२ ददवस: फाऊल पॉक्स (०.२ र्मली पांखत ककंवा मानेत) (42 Divas: Fowl Pox - 0.2 ml wing web or
neck)
7. ५६ ददवस: R2B लस (0.5 र्मली पांखत ककंवा मानेत ककंवा छातीत) (56 Divas: R2B vaccine - 0.5 ml
wing web or neck or breast)
8. ६०० ग्रॅम पक्षाला: कॉररझा लस देणे (600 gram Pakshala: Coryza las dene)
Patil Poultry House Training'),
  ('af2c7540-8480-582c-b9d4-6dd6f396e4ee', 'patil-poultry-antibiotics.pdf', 1, 'Lixen powder', 'ANTIBIOTICS
Patil Poultry House Training
Lixen powder
• किासाठी वापरतात: प्रामुख्याने E.coli (सफेद
साांडास), र्गॅंग्रीनस र्मादटायटीस (त्वचेचे रोर्ग), आणण
सांधेदुखी (Arthritis) यांसारख्या र्गंभीर आजारांवर िे
वापरले जाते.
• उपचार (Treatment): िे औषध संसर्गादची तीव्रता
पािून साधारण ३ ते ५ ददवससलर्ग हदले जाते.
• वापरण्याची पद्धत: िे पावर्र स्वकेपात येते;
साधारण १ ग्रॅम पावडर २ ते ३ शलटर पाण्यात
र्मसळून ककंवा पक्षांच्या वयानुसार र्ॉक्टरांच्या
सल्ट्ल्ट्याने पाण्यातून हदली जाते'),
  ('57f94a66-93e8-59a2-9e61-65d1473c9fc3', 'patil-poultry-antibiotics.pdf', 2, 'Tetracycline powder', 'ANTIBIOTICS
Patil Poultry House Training
Tetracycline powder
• किासाठी वापरतात: िे प्रामुख्याने मरतूक (Mortality) कमी
करण्यासाठी, कॉलरा, मानमोर्ी (Ranikhet) मधील दुय्यम संसर्गद
आणण कोंबडयांमधील ताण (Stress) घालवण्यासाठी वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षी दाणा-पाणी कमी करतात
ककंवा सुस्त िोतात, तेव्िा साधारण ३ ते ५ ददवससलर्ग िे
औषध हदले जाते.
• वापरण्याची पद्धत: िे पावर्र स्वकेपात र्मळते; साधारण १
ग्रॅम और्ध २ ते ४ शलटर पाण्यातर्मसळून ककंवा पक्षांच्या
संख्येनुसार पाण्यातून हदले जाते.'),
  ('93e3fd25-50e5-5a88-93c1-871d2d6c668c', 'patil-poultry-antibiotics.pdf', 3, 'Neodox forte powder', 'ANTIBIOTICS
Patil Poultry House Training
Neodox forte powder
• किासाठी वापरतात: िे प्रामुख्याने CRD (श्वसनाचे
आजार) आणण E.coli (पोटात इन्फेक्िन) िे दोनिी त्रास
एकाच वेळी असल्ट्यास सवादत प्रभावी ठरते.
• उपचार (Treatment): कोंबडयांमधील मरतूक
रोखण्यासाठी आणण आतडयांमधील बॅक्टेररया नष्ट
करण्यासाठी िे ३ ते ५ ददवससलर्ग हदले जाते.
• वापरण्याची पद्धत: िे पावर्र स्वकेपात असते;
साधारण १ ग्रॅम और्ध २ ते ४ शलटर पाण्यातर्मसळून
ककंवा पक्षांच्या वजनानुसार तज््
ांच्या सल्ट्ल्ट्याने हदले
जाते.'),
  ('a8cd33ec-1008-5421-a5e8-629d8faf86c5', 'patil-poultry-antibiotics.pdf', 4, 'Enrocin – BH liquid', 'ANTIBIOTICS
Patil Poultry House Training
Enrocin – BH liquid
• किासाठी वापरतात: िे प्रामुख्याने CRD (खडखड आवाज)
आणण फुफ्फुसातील दाट कफबािेर काढून श्वसन मार्गद
मोकळा करण्यासाठी वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षांना श्वास घ्यायला त्रास
िोतो ककंवा मान वर ककेन श्वास घेतात, तेव्िा साधारण
३ ते ५ ददवससलर्ग िे औषध हदले जाते.
• वापरण्याची पद्धत: िे र्लिक्वर् स्वकेपात येते; साधारण
१ शमली और्ध २ ते ४ शलटर पाण्यातर्मसळून सकाळी
ककंवा संध्याकाळी थंर् वेळेत हदले जाते.'),
  ('356838d1-349f-5faa-b7b3-d2374beaf72e', 'patil-poultry-antibiotics.pdf', 5, 'Azithromycin tablet', 'ANTIBIOTICS
Patil Poultry House Training
Azithromycin tablet'),
  ('b1f3c7c9-82b2-5e80-9650-b0a28cb20a47', 'patil-poultry-antibiotics.pdf', 6, 'Pharmasin – 100%', 'ANTIBIOTICS
Patil Poultry House Training
Pharmasin – 100%'),
  ('b8b4b18b-8e90-5e1f-9e21-22c819222871', 'patil-poultry-antibiotics.pdf', 7, '• किासाठी वापरतात: प्रामुख्याने CRD (खडखड', 'ANTIBIOTICS
• किासाठी वापरतात: प्रामुख्याने CRD (खडखड
आवाज), सदी, घशात कफ िोणे आणण
र्ोळ्यातून पाणी येणे यांसारख्याआजारांवर िे
वापरले जाते.
• उपचार (Treatment): िे औषध साधारण ३ ते
५ ददवससतत हदले जाते, ज्यामुळे कोंबडयांचा
श्वसनाचा त्रास कमी िोऊन त्या पुनिा
ॲिक्टव्ि िोतात.
• वापरण्याची पद्धत: िे पावर्र स्वकेपात येते;
साधारण १ ग्रॅम और्ध १ ते २ शलटर पाण्यात
र्मसळून कोंबडयांना सकाळी पपण्यासाठी हदले
जाते
Patil Poultry House Training
Trox'),
  ('e8e421c2-41f9-5b55-a73b-98a8de12dbe8', 'patil-poultry-antibiotics.pdf', 8, '• किासाठी वापरतात: िे प्रामुख्याने कॉक्क्सडडओशसस', 'IMPORTANT MEDICINE
• किासाठी वापरतात: िे प्रामुख्याने कॉक्क्सडडओशसस
(Coccidiosis) म्िणजेच ''रक्ती िर्गवण'' (संर्ासवाटे
रक्त पर्णे) या आजारावर उपचार करण्यासाठी
वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षी रक्तर्मथित ककंवा
पवटकरी रंर्गाची संर्ास करतात, तेव्िा संसर्गादची
तीव्रता पािून साधारण ३ ते ५ ददवससलर्गिे
औषध हदले जाते.
• वापरण्याची पद्धत: िे पावर्र स्वकेपात येते;
साधारण १ ते २ ग्रॅम पावडर १ ते २ शलटर
पाण्यातर्मसळून ककंवा र्ॉक्टरांच्या सल्ट्ल्ट्यानुसार
पपण्याच्या पाण्यातून हदले जाते.
Patil Poultry House Training
Supercox / Amprolium'),
  ('1c8bc67c-3436-5680-ac25-a4443766a705', 'patil-poultry-antibiotics.pdf', 9, '• किासाठी वापरतात: िे प्रामुख्याने यकृत सुरक्षक्षत', 'IMPORTANT MEDICINE
• किासाठी वापरतात: िे प्रामुख्याने यकृत सुरक्षक्षत
ठेवण्यासाठी, पचनशक्ती वाढवण्यासाठी आणण
पक्षांची भूक वाढवण्यासाठी वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षी दाणा कमी
खातात, त्यांची वाढ खुंटते ककंवा अँटीबायोहटकचा
कोसद सुके असतो, तेव्िा र्लव्िरवरचा ताण कमी
करण्यासाठी िे हदले जाते.
• वापरण्याची पद्धत: िे र्लिक्वर् स्वकेपात येते;
साधारण १० ते २० शमली और्ध १०० पक्षााांसाठी
पपण्याच्या पाण्यातून ५ ते ७ हदवस हदले जाते.
Patil Poultry House Training
Brotone liver tonic'),
  ('ea5d883e-9ede-58c8-802c-d684f6c5096a', 'patil-poultry-antibiotics.pdf', 10, 'Calgophos / Ostovet forte', 'IMPORTANT MEDICINE
Patil Poultry House Training
Calgophos / Ostovet forte'),
  ('4a429341-f28c-5e28-9008-70bbb9d4e644', 'patil-poultry-antibiotics.pdf', 11, '• किासाठी वापरतात: िे प्रामुख्याने पक्षांमधील', 'IMPORTANT MEDICINE
• किासाठी वापरतात: िे प्रामुख्याने पक्षांमधील
लाांगडेपणा, पाय कमजोर िोणे, मान कफरणे
आणण नसांच्या कमकुवतपणावर उपचार
करण्यासाठी वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षी पाय ओढून
चालतात ककंवा त्यांना नीट उभे रािता येत नािी,
तेव्िा त्यांच्या शरीरातील ताकद वाढवण्यासाठी िे
हदले जाते.
• वापरण्याची पद्धत: िे र्गोळ्यांच्या स्वकेपात येते;
१०० पक्षााांसाठी २ ते ३ गोळ्याबारीकककेन
पाण्यातून ककंवा दाण्यातून साधारण५ ते ७
हदवस हदल्ट्या जातात.
Patil Poultry House Training
Neurobin forte tablet /
injections'),
  ('71b01178-e239-5262-92e0-a500186e33e7', 'patil-poultry-antibiotics.pdf', 12, '• किासाठी वापरतात: प्रामुख्याने पक्षांची भूक', 'IMPORTANT MEDICINE
• किासाठी वापरतात: प्रामुख्याने पक्षांची भूक
वाढवण्यासाठी, जलद वाढ िोण्यासाठीआणण
शरीरातील िव्िटॅर्मनची कमतरता भकेन
काढण्यासाठी िे वापरले जाते.
• उपचार (Treatment): जेव्िा पक्षी दाणा कमी
खातात, सुस्त हदसतात ककंवा त्यांचीवाढ इतर
पक्षांच्या तुलनेत कमी वाटते, तेव्िा िे टॉिनक
हदले जाते.
• वापरण्याची पद्धत: िे र्लिक्वर् स्वकेपात येते;
साधारण १५ ते २० शमली और्ध १०० पक्षााांसाठी
पपण्याच्या पाण्यातून ५ ते ७ हदवस हदले जाते.
Patil Poultry House Training
Groviplex'),
  ('04536b16-dc22-5a40-8404-ea3d74238816', 'patil-poultry-antibiotics.pdf', 13, '• किासाठी वापरतात: िे प्रामुख्यानेपक्षांच्या', 'IMPORTANT MEDICINE
• किासाठी वापरतात: िे प्रामुख्यानेपक्षांच्या
पोटातील जाांत मारण्यासाठीवापरले जाते,
जेणेककेन पक्षी खाल्ट्लेला दाणा अंर्गाला लार्गेल.
• उपचार (Treatment): जेव्िा पक्षांची वाढ थांबते,
ते सुस्त िोतात ककंवा पवष्ठेमध्येजंत
हदसतात, तेव्िा िे औषध एका र्ोसमध्ये हदले
जाते.
• वापरण्याची पद्धत: िे र्लिक्वर् स्वकेपात येते;
साधारण ३० ते ४५ शमली और्ध १००
पक्षााांसाठीसकाळी ररकाम्या पोटीपपण्याच्या
पाण्यातून हदले जाते.
Patil Poultry House Training
Albomar'),
  ('cb47ab23-e393-5b56-a8b2-e7e47712e33c', 'patil-poultry-antibiotics.pdf', 14, 'Sokrena', 'WATER SANITISER
Patil Poultry House Training
Sokrena'),
  ('f8440e6f-0f2a-5461-88a5-72097cc4a2bf', 'patil-poultry-antibiotics.pdf', 15, 'CIPLOX', 'EYE DROPS
Patil Poultry House Training
CIPLOX
GENTAMICIN'),
  ('98fd3220-be7b-51ac-8f35-9931e06a1f89', 'patil-poultry-antibiotics.pdf', 16, 'पपसवा SOLUTION', 'पपसवा SOLUTION
Patil Poultry House Training
BUTOX
CLINAR'),
  ('291c6e3e-4564-5a3c-a90a-ade237af2ec6', 'patil-poultry-antibiotics.pdf', 17, 'VIRKON - S', 'DISINFECTION SOLUTION
Patil Poultry House Training
VIRKON - S
B904
KHORSOLIN -TH'),
  ('19a7dcd2-68b2-5c9f-bfda-7694deaad79b', 'patil-poultry-antibiotics.pdf', 18, 'INJECTIONS', 'INJECTIONS
Patil Poultry House Training
TAMIK
NEUROBIN – FORTE
GENTAMICIN'),
  ('69f8301a-066f-5052-9f30-f65114c336c9', 'patil-poultry-diseases-symptoms-medicines.pdf', 1, 'कोंबड्याांचे आजार, लक्षणेव', 'कोंबड्याांचे आजार, लक्षणेव
त्यावरील औषधाांची यादी
89'),
  ('c0b78d7f-7bff-5b18-a6ae-ee0094ec484f', 'patil-poultry-diseases-symptoms-medicines.pdf', 2, '1. मरेक्स रोग ( Mareks Disease )', '1. मरेक्स रोग ( Mareks Disease )
90
लक्षणे
•
पांख गळणे
•
वजन कमी होणे
•
मान गळून जाणे अथवा
लकवा येणे
•
लांगडणे
•
तुऱ्याचा रांग जाांभळा होणे
•
श्वास घेताना त्रास होणे
•
पांखात लकवा येणे
प्राथममक उपचार
•
योग्य लसीकरण आवश्यक
आहे.
•
िामवची योग्य स्वच्छता
ननयममतपणे करणे आवश्यक
आहे
औषधे
•
Marek''s लस'),
  ('e8668522-9ff2-5f81-a4b3-e107a389c5d0', 'patil-poultry-diseases-symptoms-medicines.pdf', 3, '2. एस्पव्जवलोमसस रोग', '2. एस्पव्जवलोमसस रोग
(ASPERGELOSES) बुरशीजन्य सांसगव आहे
91
लक्षणे
•
ताप येणे
•
अन्न पाणी सोडणे
•
तोंडाने श्वास घेणे
•
जोराने श्वास घेणे
•
पपल्ले अशक्त होणे
•
मान जाड होणे
•
थर थर कापणे
प्राथममक उपचार
•
शेडमधील खालील तुस व
कोंडा बदलावा
•
धान्यात ओलावा नाही याची
खात्री करावी
औषधे
•
Antibiotic देणे
•
कॉपर सल्िेट ०. ५ ग्राम १
मलटर पाण्यात द्यावे
•
२५ ग्राम कॉपर सल्िेट १५
मलटर पांपात घेऊन धान्याची व
पाण्यानी भाांडी बाजूला काढून
िामव वर िवारणी करावी'),
  ('6fc3d8e9-111b-5f03-bd26-1bc580b26dfe', 'patil-poultry-diseases-symptoms-medicines.pdf', 4, '3. गाऊट रोग ( Gout Disease )', '3. गाऊट रोग ( Gout Disease )
92
लक्षणे
•
पाांढरी पवष्ठा
(सांडास) करणे
•
पातळ पवष्ठा
(सांडास) करणे
•
पायाला ककांवा
बोटाांना सूज येणे
प्राथममक उपचार
•
प्रथम युरोफ्रेश औषध द्या जे
शरीरातून युररक अ ॅमसड
काढून टाकते. त्यानांतर२
हदवस नेफ्रोकेअर औषध द्या.
औषधे
•
Urofesh
•
Nephrocare'),
  ('3f9b2b76-53a9-58cd-a0b2-6ee6cd1ecaeb', 'patil-poultry-diseases-symptoms-medicines.pdf', 5, '4. व्व्हटॅममनची कमतरता', '4. व्व्हटॅममनची कमतरता
( Vitamin Deficiency )
93
लक्षणे
•
मान वाकणे
•
पाय वाकणे
प्राथममक उपचार
•
मल्टीपवटाममन द्या
औषधे
•
Vimeral
•
Multistar
•
B-Complex'),
  ('7351f8ba-4c74-5bc0-b2c5-26550a5a991a', 'patil-poultry-diseases-symptoms-medicines.pdf', 6, '5. इकोलाई सांसगव ( E-Coli)', '5. इकोलाई सांसगव ( E-Coli)
94
लक्षणे
•
एका जागेवर बसून
राहणे
•
अन्न पाणी सोडणे
•
डोळे बारीक होणे
•
पाय सुकणे
•
डोक्याला सूज येणे
•
अमोननया गॅस
बनणे
प्राथममक उपचार
•
सवव पाण्याची भाांडी स्वच्छ
करा.
•
पक्ष्याांना स्वच्छ पाणी द्या
औषधे
•
Enrocin BH Antibiotic देणे'),
  ('0994dd68-fc61-5d81-8347-f2faad2ba8ee', 'patil-poultry-diseases-symptoms-medicines.pdf', 7, '6. पुलोरम रोग( Pullorum Disease)', '6. पुलोरम रोग( Pullorum Disease)
95
लक्षणे
•
पपल्लाांची पाांढरी
पवष्ठा मागच्या
बाजूला चचकटलेली
असते
•
योग्य ब्रूडडांगमध्येही
पपलाांना थांडी
जाणवते.
प्राथममक उपचार
•
सांक्रममत पपल्ले इतर
पपल्लाांपासून वेगळी करा.
•
Antibiotic+Multivitamin
देणे
औषधे
•
Lexin powder Antibiotic देणे'),
  ('e1b2e8d4-3afb-5702-8811-29aee5b31e96', 'patil-poultry-diseases-symptoms-medicines.pdf', 8, '7. रक्ती हगवण (coccidiosis)', '7. रक्ती हगवण (coccidiosis)
96
लक्षणे
•
रक्ती हगवण येणे
•
जुलाब होणे
•
कमकुवत होणे
•
अन्न पाणी न
खाणे
•
डोळे ममटून बसून
राहणे
प्राथममक उपचार
•
सांक्रममत कोंबडीला
इतराांपासून वेगळे
करा.
•
चाांगला आहार द्या
औषधे
•
एम्प्रोमलयम पावडर - 30 ग्रॅम पावडर
25 मलटर पाण्यात 5-7 हदवसाांसाठी
१०० पपलाांसाठी
•
सुपर कॉक्स - १४ हदवसाांच्या वयाच्या
पपलाांसाठी २ ग्रॅम पावडर १ मलटर
पाण्यात 5-7 हदवसाांसाठी
देणेसुपरकॉक्स - ४ ते ५ आठवडे
वयाच्या पपलाांसाठी ४ ग्रॅमपावडर १. ५
मलटर पाण्यात 5-7 हदवसाां साठी
देणेसुपरकॉक्स - ८ ते १० आठवडे
वयाच्या पपलाांसाठी ६ ग्रॅम पावडर २
मलटर पाण्यात 5-7 हदवसाांसाठीदेणे'),
  ('32e403ae-69da-5e75-be20-c183701a413e', 'patil-poultry-diseases-symptoms-medicines.pdf', 9, '8. रानीखेत रोग( Newcastle Disease ND)', '8. रानीखेत रोग( Newcastle Disease ND)
97
लक्षणे
•
मान झटकणे
•
लकवा येणे
•
मiन वाकडी होणे
अथवा आकाशाकडे
बघणे
•
हहरवी पवष्ठा करणे
•
अन्न पाणी न
खाणे
प्राथममक उपचार
•
६,२१,५१ हदवशी राणीखेत
लस देणे
•
5ml Paracetamol
+
2 limcee Vitamin C tablets
+
2 Evion 400 Tablets
+
2 Litre Water
•
हे सूत्र पक्ष्याांना ५
हदवसाांसाठी द्या.
औषधे
•
Paracetamol लहान पोराांचा
•
Limcee Vitamin C
•
Evion 400 Vitamin E'),
  ('4348aa3e-848f-563d-8372-995beb6734e6', 'patil-poultry-diseases-symptoms-medicines.pdf', 10, '9. गांबोरो (Infectious Bursal Disease (IBD)', '9. गांबोरो (Infectious Bursal Disease (IBD)
लक्षणे
•
पाय दाबून खाली
बसणे
•
पांख पसरून बसणे
•
डोके जममनीवर
ठेवणे
•
शौचाच्या जागी
स्वतः चावणे ककांवा
टोचा मारणे
•
शौचाला पपवळीव
पातळ करणे
•
अन्न पाणी न
खाणे
प्राथममक उपचार
•
६,२१,५१ हदवशी राणीखेत
लस देणे
•
5ml Paracetamol
+
2 limcee Vitamin C tablets
+
2 Evion 400 Tablets
+
2 Litre Water
•
हे सूत्र पक्ष्याांना ५
हदवसाांसाठी द्या.
औषधे
•
Paracetamol लहान पोराांचा
•
Limcee Vitamin C
•
Evion 400 Vitamin E'),
  ('0d69e970-6280-5f68-8c9a-f44e352b49d9', 'patil-poultry-diseases-symptoms-medicines.pdf', 11, '10. सांसगवजन्य ब्राँकायहटस(Infectious Bronchitis IB)', '10. सांसगवजन्य ब्राँकायहटस(Infectious Bronchitis IB)
99
लक्षणे
•
कोंबडीमध्ये तोंड
उघडे श्वास घेणे
•
श्वास घेताना
कोंबडीतून मशट्टीचा
आवाज येतो.
•
डोळ्यातून सतत
पाणी वाहते
•
डोळ्याांजवळ केस
गळतात
•
कोंबडी
माणसाांसारखी सरळ
चालते.
प्राथममक उपचार
•
IB लस
•
Tetracycline पावडर पान्यात
देने
•
इलेक्रोलाइट पावडर without
रक्त बिर सोडडयम
औषधे
• Tetracyline powder
• Electrolyte powder'),
  ('04b21567-6cee-5b8f-8f2e-8bebeeb1fb48', 'patil-poultry-diseases-symptoms-medicines.pdf', 12, '11. क्रोननक रेस्पोरेटरी डडसेस (CRD)', '11. क्रोननक रेस्पोरेटरी डडसेस (CRD)
100
लक्षणे
•
कोंबडीला मशांका येणे
•
मान झटकणे
•
डोळ्यातून व नाकातून
पाणी येणे
•
अन्न पाणी कमी खाणे
•
डोळे बांद करून उभे
राहणे
•
शौचास पाांढरी होणे
•
ह्या आजाराच्या
कोंबड्याांचे शवपवच्छेदन
केल्यानांतर असे हदसून
येते कक कोंबडीचे हृदय
मोठे झाले आहे आणण
श्वसन नमलकेत कि
जमा झालेला आहे
प्राथममक उपचार
•
१०० ग्राम लसूण
•
१०० ग्राम आले
•
५० ग्राम ओवा
•
२० काळी ममरी
•
१० लवांग
•
आधाव चमचा हळद पावडर
•
५० ग्राम गुळ
•
वरील सवव एकत्र करून ५०० ममली पाण्यामध्ये १०
ते १५ ममननटे उकळून घ्यावे साधारणपणे ४०० ममली
काटा होईपयंत उकळावे नांतर थांड झाल्यावर न
गाळता कोंबड्याांच्या पपण्याच्या पाण्यामध्ये चहाचा
कपभर ममसळावे, िामव छाया सगळ्या भाांड्याांमध्ये
प्रत्येकी १ कप ममसळावे. आठवड्यातून एकदा
कोंबड्याना हदल्यावर आपल्या िामव मध्येCRD येत
नाही. तयार झालेले ममश्रण ४५ हदवसापयंत ्
लाव्स्टक च्या बाटली मध्ये ठेवू शकतो
औषधे'),
  ('bbd1df70-201c-503e-8b6e-a4c5796ba84c', 'patil-poultry-diseases-symptoms-medicines.pdf', 13, '12. िाउल पॉक्स( Fowl Pox)', '12. िाउल पॉक्स( Fowl Pox)
101
लक्षणे
•
तोंडावर ककवा
तुयावर िोड्या येणे
प्राथममक उपचार
•
िाऊल िॉक्स झालेल्या
जागी डेटॉल ककांवा सपट
लोशन हलक्या हाताने चोळून
लावावे ३ ते ५ हदवसाांत
िरक पडतो. ककांवा
•
कडुमलांबाचा पाला बारीक
पावडर करून त्यात थोडे
मोहरीचे तेल ममसळून
जखमाांवर हलक्या हाताने
चोळावे िरक पडतो.
औषधे
•
ह्या रोगावरची पहहली लस४२
ते ४५ हदवसाांत द्यावी लागते
(0.25 एमएल) ह्या रोगावरची
दुसरी लस ९० ते १०० हदवसाांत
द्यावी लागते (0.5 एमएल)
•
THUJA 200 (थुजा 200) - 10
ममली प्रनत 100 पपल्ले 2
मलटर पाण्यात 5 हदवसाांसाठी'),
  ('70f8de99-8781-5319-80e7-02faa6f96474', 'patil-poultry-diseases-symptoms-medicines.pdf', 14, '13. सांसगवजन्य कोररझा(Infectious Coryza)', '13. सांसगवजन्य कोररझा(Infectious Coryza)
102
लक्षणे
•
डोळ्यातून पाणी
येणे
•
नाकातून पाणी येणे
•
डोळे चचकटणे
•
डोळ्यात घाण जमा
होणे
•
श्वासोच्छवास
घेण्यास त्रास होणे
प्राथममक
उपचार
•
बाचधत कोंबड्याांना
लगेचच िामवच्या
इतर
कोंबड्याांपासून
वेगळे ठेवा.
•
कोंबडीचा
चचकटलेला डोला
स्वच्छ करुण घेण
औषधे
•
AZYTHROMYCIN द्रव / पावडर - ५ ममली/५
ग्रॅम औषध, १ मलटर पाण्यात 100
पपल्लाांसाठी, २-३ हदवस ४ ते ५
आठवड्याच्या पपलाांसाठी तसेच मोठ्या
कोंबड्याांसाठी १० ममली / १० ग्रॅमऔषध, ३
मलटर पाण्यात प्रत्येकी 100 पपल्लाांसाठी/
कोंबड्याांसाठी, २-३ हदवस
•
BETNESOL बेटनेसॉल - एन (आय ड्रॉ्स)
GENTAMYCIN जेंटामायमसन (आय ड्रॉ्स)
हदवसातून २ वेळा एक थेंब कोंबडीच्य
डोळ्यामध्ये कुठल्याही वेळी टाकूशकता'),
  ('31397860-1228-567e-b573-56f565060aa2', 'patil-poultry-diseases-symptoms-medicines.pdf', 15, '14. कॅननबामलझम(CANABALISM)', '14. कॅननबामलझम(CANABALISM)
103
लक्षणे
•
प्रोटीन, कॅव्ल्शयम
कमी होणे ककवा
कमी देणे
•
मादी कोंबडीच्या
तुलनेत नर
कोंबडीची सांख्या
जास्त आहे.
•
कोंबड्याना जागेची
कमतरता भासने
प्राथममक उपचार
•
Proper Nutrition
औषधे
•
Himax Cream -हे क्रेमआयन
जखमेवर लावा'),
  ('10381bf3-7f2b-5032-b352-cd4013a71da2', 'patil-poultry-diseases-symptoms-medicines.pdf', 16, '15. लांगडेपणा आजार', '15. लांगडेपणा आजार
104
लक्षण
•
कॅव्ल्शअम ची कमी
होणे
•
व्व्हटॅममन B ची
कमी होणे
•
व्व्हटॅममन E ची
कमी होणे
प्राथममक
उपचार
•
१ मलटर गावरान
गाईच्या कच्च्या
दूधामध्ये १०० ग्राम
साखर ममसळून ते
१०० पपल्लाना
आणण मोठ्या ५०
कोंबड्याना ३ हदवस
देणे, लांगडेपणा
कमी होतो
औषधे
•
न्यूरोबबयन िोटव (NEUROBION
FORTE) - 1 टॅब्लेट पाण्यात
पवरघळवून 200 पपल्ले ककांवा50
कोंबड्याांवर पपण्याच्या पाण्यात
ममसळून ५ हदवस देणे
•
न्यूरोकाइांड-्लस (NEUROKIND-
PLUS VET) - पायात ककांवा डाव्या
पवांगमध्ये 0.5 एमएल इांजेक्शन
कोंबड्याना हदवसातून दोनदा ३
हदवस देणे
•
रायबबवेट (TRIBIVET) - 0.5
एमएल इांजेक्शन कोंबडीच्या
पायात ककांवा डाव्या पांखात
हदवसातून एकदा हदवसाआड ३
हदवस देणे'),
  ('66e5a451-124f-59c4-bd7e-9e2fc11623a7', 'patil-poultry-diseases-symptoms-medicines.pdf', 17, '16. पोटॅट जांत होन (Worms inside Chicken', '16. पोटॅट जांत होन (Worms inside Chicken
Stomach)
105
लक्षणे
•
वजन कमी होणे
•
मल मध्ये जांत
हदसतात
प्राथममक उपचार
•
दार 30 हदवस मलांबाचा
पल्याचा रस पणीत ममक्स
करूण दे
औषधे
•
Albomar'),
  ('11d4f25f-3b16-553d-85d8-45be07ab38cf', 'patil-poultry-diseases-symptoms-medicines.pdf', 18, '•धन्यवाद', '106
•धन्यवाद');
