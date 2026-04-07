const { Pool } = require('pg');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  keka_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'requester',
  skills TEXT[] DEFAULT '{}',
  capacity INTEGER DEFAULT 0,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  show TEXT,
  status TEXT DEFAULT 'active',
  description TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  asset_type_id TEXT NOT NULL,
  department TEXT,
  platforms TEXT[] DEFAULT '{}',
  assigned_to TEXT REFERENCES users(id),
  status TEXT DEFAULT 'intake',
  priority TEXT DEFAULT 'medium',
  go_live_date DATE,
  internal_deadline DATE,
  brief JSONB DEFAULT '{}',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  asset_type_id TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  assigned_to TEXT REFERENCES users(id),
  status TEXT DEFAULT 'intake',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  request_id TEXT REFERENCES requests(id),
  date DATE NOT NULL,
  hours NUMERIC(4,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  content TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_schedule (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  platform TEXT,
  scheduled_date DATE,
  status TEXT DEFAULT 'planned',
  assigned_to TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const seedUsers = `
INSERT INTO users (id, keka_id, name, email, role, designation, reports_to_name, joined_at, is_active, skills, capacity) VALUES
  ('u_soumya_mukherjee', 'HOI003', 'Soumya Mukherjee', 'soumya.mukherjee@svf.in', 'creative_lead', 'Chief Operating Officer', 'Vishnu Kant Mohta', '2017-06-01', true, '{}', 0),
  ('u_sourav_ghosh', 'HOI010', 'Sourav Ghosh', 'sourav.ghosh@svf.in', 'requester', 'Manager - Post Production', 'Rajib Biswas', '2017-06-01', true, '{}', 0),
  ('u_salankara_biswas', 'HOI014', 'Salankara Biswas', 'salankara.biswas@hoichoi.tv', 'requester', 'GM - Content Marketing & Discovery', 'Soumya Mukherjee', '2017-06-05', true, '{}', 0),
  ('u_moloy', 'HOI032', 'Moloy Karmakar', 'moloy@hoichoi.tv', 'requester', 'GM- Product Ops', 'Aloke Majumder', '2018-01-05', true, '{}', 0),
  ('u_sujit_sen', 'HOI034', 'Sujit Sen', 'sujit.sen@svf.in', 'requester', 'Manager - Accounts', 'Abhishek Jhunjhunwala', '2018-03-05', true, '{}', 0),
  ('u_aloke', 'HOI047', 'Aloke Majumder', 'aloke@svf.in', 'creative_lead', 'VP - Technology', 'Vishnu Kant Mohta', '2018-10-01', true, '{}', 0),
  ('u_sandipan_mondal', 'HOI044', 'Sandipan Mondal', 'sandipan.mondal@hoichoi.tv', 'requester', 'Manager - Tech & Content Ops', 'Aloke Majumder', '2018-10-08', true, '{}', 0),
  ('u_mandar_banerjee', 'HOI072', 'Mandar Banerjee', 'mandar.banerjee@hoichoi.tv', 'creative_lead', 'AV - Head', 'Vishnu Kant Mohta', '2020-01-10', true, '{}', 0),
  ('u_ruchita_chatterji', 'HOI075', 'Ruchita Chatterji', 'ruchita.chatterji@hoichoi.tv', 'requester', 'Manager - Subtitles, S&P and Ops', 'Mandar Banerjee', '2020-02-01', true, '{}', 0),
  ('u_sayantan_guha', 'HOI085', 'Sayantan Guha', 'sayantan.guha@hoichoi.tv', 'requester', 'GM - Brand Strategy', 'Soumya Mukherjee', '2020-06-23', true, '{}', 0),
  ('u_pratik_banerjee', 'HOI184', 'Pratik Banerjee', 'pratik.banerjee@hoichoi.tv', 'video_editor', 'Editor', 'Mandar Banerjee', '2020-07-01', true, '{}', 0),
  ('u_arnab_bhattacharjee', 'HOI092', 'Arnab Bhattacharjee', 'arnab.bhattacharjee@hoichoi.tv', 'requester', 'Manager - Promos', 'Salankara Biswas', '2020-10-28', true, '{}', 0),
  ('u_shreya_kaushik', 'HOI110', 'Shreya Kaushik', 'shreya.kaushik@hoichoi.tv', 'requester', 'Sr. Manager - Brand Alliances & Partnerships', 'Sayantan Guha', '2021-03-22', true, '{}', 0),
  ('u_mangaldeep_karmakar', 'HOI121', 'Mangaldeep Karmakar', 'mangaldeep.karmakar@hoichoi.tv', 'designer', 'Asst. Manager - Motion Graphics', 'Salankara Biswas', '2021-08-09', true, '{}', 0),
  ('u_rajib', 'HOI124', 'Rajib Biswas', 'rajib@svf.in', 'creative_lead', 'VP - Post Production', 'Soumya Mukherjee', '2021-08-17', true, '{}', 0),
  ('u_debmalya_mukherjee', 'HOI140', 'Debmalya Mukherjee', 'debmalya.mukherjee@hoichoi.tv', 'video_editor', 'Editor', 'Arnab Bhattacharjee', '2022-02-07', true, '{}', 0),
  ('u_nikhita_chatterjee', 'HOI162', 'Nikhita Chatterjee', 'nikhita.chatterjee@hoichoi.tv', 'requester', 'Executive - Customer Support', 'Sayantan Raha', '2022-05-23', true, '{}', 0),
  ('u_sera_banerjee', 'HOI209', 'Sera Banerjee', 'sera.banerjee@hoichoi.tv', 'creative_lead', 'Content Head - hoichoi', 'Soumya Mukherjee', '2022-05-25', true, '{}', 0),
  ('u_ipsita_mukherjee', 'HOI167', 'Ipsita Mukherjee', 'ipsita.mukherjee@hoichoi.tv', 'requester', 'Assistant Manager - Content Operations', 'Salankara Biswas', '2022-06-15', true, '{}', 0),
  ('u_nitaichand_das', 'HOI175', 'Nitai Chand Das', 'nitaichand.das@hoichoi.tv', 'video_editor', 'Editor', 'Arnab Bhattacharjee', '2022-07-27', true, '{}', 0),
  ('u_sagnik_ghosh', 'HOI178', 'Sagnik Ghosh', 'sagnik.ghosh@hoichoi.tv', 'designer', 'Sr. Executive - Graphic Design', 'Arnab Bhattacharjee', '2022-09-01', true, '{}', 0),
  ('u_honey_agarwal', 'HOI185', 'Honey Agarwal', 'honey.agarwal@svf.in', 'requester', 'Asst. Manager - Accounts', 'Abhishek Jhunjhunwala', '2022-12-01', true, '{}', 0),
  ('u_debanjan_dasgupta', 'HOI187', 'Debanjan Dasgupta', 'debanjan.dasgupta@hoichoi.tv', 'requester', 'Sr. Executive - Social Media', 'Sayantan Guha', '2022-12-20', true, '{}', 0),
  ('u_gaurav_tyagi', 'HOI191', 'Gaurav Tyagi', 'gaurav.tyagi@hoichoi.tv', 'requester', 'Android Developer', 'Moloy Karmakar', '2023-04-20', true, '{}', 0),
  ('u_s_das', 'HOI192', 'Sanjoy Das', 's.das@svf.in', 'requester', 'Executive - Accounts', 'Abhishek Jhunjhunwala', '2023-04-24', true, '{}', 0),
  ('u_ritika_das', 'HOI206', 'Ritika Das', 'ritika.das@hoichoi.tv', 'designer', 'Executive - Motion Graphics', 'Mangaldeep Karmakar', '2023-08-01', true, '{}', 0),
  ('u_satyajit_maji', 'HOI137', 'Satyajit Maji', 'satyajit.maji@hoichoi.tv', 'requester', 'Executive - Post Production', 'Sourav Ghosh', '2023-08-16', true, '{}', 0),
  ('u_pronay_roy', 'HOI207', 'Pronay Roy', 'pronay.roy@hoichoi.tv', 'requester', 'Asst Manager Digital Marketing', 'Gunturu Sai Avinash', '2023-08-16', true, '{}', 0),
  ('u_ishani_bose', 'HOI156', 'Ishani Bose', 'ishani.bose@hoichoi.tv', 'requester', 'Sr. Executive - Social Media', 'Sayantan Guha', '2023-10-11', true, '{}', 0),
  ('u_anirban_jana', 'HOI210', 'Anirban Jana', 'anirban.jana@hoichoi.tv', 'requester', 'Asst Manager Digital Marketing', 'Gunturu Sai Avinash', '2023-11-20', true, '{}', 0),
  ('u_pritam_ghosh', 'HOI111', 'Pritam Ghosh', 'pritam.ghosh@hoichoi.tv', 'requester', 'Creative Content Producer', 'Salankara Biswas', '2024-01-15', true, '{}', 0),
  ('u_sreya_dutta', 'HOI216', 'Sreya Dutta', 'sreya.dutta@hoichoi.tv', 'requester', 'Associate - Content', 'Sera Banerjee', '2024-01-22', true, '{}', 0),
  ('u_binay_bhowmick', 'HOI221', 'Binay Bhowmick', 'binay.bhowmick@hoichoi.tv', 'requester', 'Sr. Associate - Post Production', 'Sourav Ghosh', '2024-03-11', true, '{}', 0),
  ('u_roshni_bose', 'HOI226', 'Roshni Bose', 'roshni.bose@hoichoi.tv', 'designer', 'Associate - Graphic Design', 'Arnab Bhattacharjee', '2024-05-08', true, '{}', 0),
  ('u_adhidev_mukherjee', 'HOI228', 'Adhidev Mukherjee', 'adhidev.mukherjee@hoichoi.tv', 'creative_lead', 'Content Head - New Formats', 'Soumya Mukherjee', '2024-05-15', true, '{}', 0),
  ('u_medha_mukherjee', 'HOI230', 'Medha Mukherjee', 'medha.mukherjee@svf.in', 'requester', 'Associate - Legal', 'Preeti Gandhi', '2024-05-28', true, '{}', 0),
  ('u_abhijan_chakraborty', 'HOI232', 'Abhijan Chakraborty', 'abhijan.chakraborty@hoichoi.tv', 'requester', 'Content Producer - New Formats', 'Adhidev Mukherjee', '2024-06-03', true, '{}', 0),
  ('u_saswati_sinha', 'HOI235', 'Saswati Sinha', 'saswati.sinha@hoichoi.tv', 'requester', 'Content Producer - New Formats', 'Adhidev Mukherjee', '2024-06-11', true, '{}', 0),
  ('u_rithuparna_ghosh', 'HOI236', 'Rithuparna Ghosh', 'rithuparna.ghosh@hoichoi.tv', 'requester', 'Content Producer - New Formats', 'Adhidev Mukherjee', '2024-06-11', true, '{}', 0),
  ('u_anurag_ghosh', 'HOI238', 'Anurag Ghosh', 'anurag.ghosh@hoichoi.tv', 'requester', 'Asst. Manager - Marketing', 'Sayantan Guha', '2024-07-01', true, '{}', 0),
  ('u_sai_avinash', 'HOI241', 'Gunturu Sai Avinash', 'sai.avinash@hoichoi.tv', 'requester', 'Sr. Manager - Performance Marketing', 'Soumya Mukherjee', '2024-09-02', true, '{}', 0),
  ('u_sayantan_raha', 'HOI242', 'Sayantan Raha', 'sayantan.raha@hoichoi.tv', 'requester', 'Manager - Customer Experience & Quality Control', 'Moloy Karmakar', '2024-10-15', true, '{}', 0),
  ('u_alokananda_sengupta', 'HOI243', 'Alokananda Sengupta', 'alokananda.sengupta@hoichoi.tv', 'requester', 'Associate - Data Analyst', 'Gunturu Sai Avinash', '2024-11-11', true, '{}', 0),
  ('u_akancha_pipalwa', 'HOI244', 'Akancha Pipalwa', 'akancha.pipalwa@hoichoi.tv', 'requester', 'Associate - Content Operations (Hindi)', 'Ruchita Chatterji', '2024-11-11', true, '{}', 0),
  ('u_anwesha_debnath', 'HOI247', 'Anwesha Debnath', 'anwesha.debnath@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-01-20', true, '{}', 0),
  ('u_sarthak_dassharma', 'HOI248', 'Sarthak Das Sharma', 'sarthak.dassharma@hoichoi.tv', 'requester', 'Creative Producer', 'Sera Banerjee', '2025-02-03', true, '{}', 0),
  ('u_soumi_banerjee', 'HOI249', 'Soumi Banerjee', 'soumi.banerjee@hoichoi.tv', 'requester', 'Associate - CRM', 'Gunturu Sai Avinash', '2025-03-03', true, '{}', 0),
  ('u_diptesh_bhattacharya', 'HOI251', 'Diptesh Bhattacharya', 'diptesh.bhattacharya@hoichoi.tv', 'requester', 'Asst. Manager - Creative Solutions', 'Shreya Kaushik', '2025-03-19', true, '{}', 0),
  ('u_sushim_dutta', 'HOI252', 'Sushim Ranjan Dutta', 'sushim.dutta@hoichoi.tv', 'requester', 'Manager - Talent Acquisition', 'Soumya Mukherjee', '2025-03-19', true, '{}', 0),
  ('u_debayani_panigrahi', 'HOI253', 'Debayani Panigrahi', 'debayani.panigrahi@hoichoi.tv', 'requester', 'Associate - Customer Support', 'Sayantan Raha', '2025-04-01', true, '{}', 0),
  ('u_sambhav_khetrapal', 'SOP001', 'Sambbhav Khettrapal', 'sambhav.khetrapal@hoichoi.tv', 'creative_lead', 'Head - Content (Fiction)', 'Soumya Mukherjee', '2025-05-01', true, '{}', 0),
  ('u_shoham_banerjee', 'SOP002', 'Shoham Banerjee', 'shoham.banerjee@hoichoi.tv', 'requester', 'Creative Executive Producer', 'Sambbhav Khettrapal', '2025-05-14', true, '{}', 0),
  ('u_shinjini_nandy', 'CON255', 'Shinjini Nandy', 'shinjini.nandy@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-05-20', true, '{}', 0),
  ('u_updesh', 'CON256', 'Updesh', 'updesh@hoichoi.tv', 'requester', 'Sr Promo Producer', 'Mandar Banerjee', '2025-05-26', true, '{}', 0),
  ('u_sayan_maiti', 'CON257', 'Sayan Maiti', 'sayan.maiti@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-06-02', true, '{}', 0),
  ('u_aranyak_chatterjee', 'HOI256', 'Aranyak Chatterjee', 'aranyak.chatterjee@hoichoi.tv', 'requester', 'Executive Producer', 'Sera Banerjee', '2025-06-02', true, '{}', 0),
  ('u_saswati_mitra', 'HOI257', 'Saswati Mitra', 'saswati.mitra@hoichoi.tv', 'requester', 'Executive - Customer Support', 'Sayantan Raha', '2025-06-02', true, '{}', 0),
  ('u_arnab_neogi', 'HOI259', 'Arnab Neogi', 'arnab.neogi@hoichoi.tv', 'video_editor', 'Video Editor', 'Arnab Bhattacharjee', '2025-06-25', true, '{}', 0),
  ('u_sougata_bhowmik', 'CON265', 'Sougata Bhowmick', 'sougata.bhowmik@hoichoi.tv', 'video_editor', 'Video Editor', 'Arnab Bhattacharjee', '2025-07-01', true, '{}', 0),
  ('u_ashish_mallik', 'CON266', 'Ashish Mallick', 'ashish.mallik@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-07-01', true, '{}', 0),
  ('u_swarnavo_banerjee', 'HOI260', 'Swarnavo Banerjee', 'swarnavo.banerjee@hoichoi.tv', 'requester', 'Associate - Creative Communications', 'Salankara Biswas', '2025-07-01', true, '{}', 0),
  ('u_kapil_jain', 'CON268', 'Kapil Jain', 'kapil.jain@hoichoi.tv', 'requester', 'Quality Analyst (QA)', 'Moloy Karmakar', '2025-07-15', true, '{}', 0),
  ('u_sayandeep_dey', 'HOI262', 'Sayandeep Dey', 'sayandeep.dey@hoichoi.tv', 'requester', 'Full Stack Developer', 'Moloy Karmakar', '2025-08-04', true, '{}', 0),
  ('u_sumona_mondal', 'CON263', 'Sumona Mondal', 'sumona.mondal@hoichoi.tv', 'video_editor', 'Video Editor', 'Mandar Banerjee', '2025-08-07', true, '{}', 0),
  ('u_shaket_banerjee', 'HOI263', 'Shaket Banerjee', 'shaket.banerjee@hoichoi.tv', 'creative_lead', 'Creative Director - AI', 'Mandar Banerjee', '2025-08-25', true, '{}', 0),
  ('u_amit_kumar', 'CON269', 'Amit Kumar', 'amit.kumar@hoichoi.tv', 'video_editor', 'Senior Colorist', 'Rajib Biswas', '2025-09-08', true, '{}', 0),
  ('u_shabinder_singh', 'HOI246', 'Shabinder Singh', 'shabinder.singh@hoichoi.tv', 'requester', 'Android Developer', 'Vishnu Kant Mohta', '2025-10-01', true, '{}', 0),
  ('u_ishika_ganguly', 'HOI265', 'Ishika Ganguly', 'ishika.ganguly@hoichoi.tv', 'requester', 'Senior Associate - CRM & Retention', 'Gunturu Sai Avinash', '2025-10-15', true, '{}', 0),
  ('u_soumen_majumdar', 'HOI272', 'Soumen Majumdar', 'soumen.majumdar@hoichoi.tv', 'designer', 'Associate - Graphics', 'Arnab Bhattacharjee', '2025-11-01', true, '{}', 0),
  ('u_avinash_singh', 'HOI266', 'Avinash Singh', 'avinash.singh@hoichoi.tv', 'requester', 'Sr. Software Engineer', 'Moloy Karmakar', '2025-11-03', true, '{}', 0),
  ('u_disha_roy', 'HOI267', 'Disha Roy', 'disha.roy@hoichoi.tv', 'requester', 'Associate - Brand Partnerships', 'Shreya Kaushik', '2025-11-03', true, '{}', 0),
  ('u_boloram_mitra', 'HOI271', 'Boloram Mitra', 'boloram.mitra@hoichoi.tv', 'creative_lead', 'Team Lead - CX & QA', 'Sayantan Raha', '2025-11-05', true, '{}', 0),
  ('u_mayukh_das', 'HOI270', 'Mayukh Das', 'mayukh.das@hoichoi.tv', 'requester', 'Management Trainee', 'Soumya Mukherjee', '2025-11-10', true, '{}', 0),
  ('u_shantuno_chakraborty', 'CON272', 'Shantuno Chakraborty', 'shantuno.chakraborty@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-11-17', true, '{}', 0),
  ('u_sreemoyee_banerjee', 'HOI273', 'Sreemoyee Banerjee', 'sreemoyee.banerjee@hoichoi.tv', 'requester', 'Executive Producer', 'Sayantan Guha', '2025-12-01', true, '{}', 0),
  ('u_shreya_paul', 'CON275', 'Shreya Paul', 'shreya.paul@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-12-08', true, '{}', 0),
  ('u_gaurav_kuri', 'CON276', 'Gaurav Kuri', 'gaurav.kuri@hoichoi.tv', 'creative_lead', 'Associate - Creative Director - AI', 'Mandar Banerjee', '2025-12-08', true, '{}', 0),
  ('u_sarani_deb', 'CON277', 'Sarani Deb', 'sarani.deb@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2025-12-15', true, '{}', 0),
  ('u_gursevak_singh', 'HOI274', 'Gursevak Singh Gill', 'gursevak.singh@hoichoi.tv', 'requester', 'Software Engineer', 'Moloy Karmakar', '2025-12-22', true, '{}', 0),
  ('u_keerthana_anand', 'CON278', 'Keerthana Anand', 'keerthana.anand@hoichoi.tv', 'requester', 'Consultant - International Content Sales', 'Soumya Mukherjee', '2026-01-01', true, '{}', 0),
  ('u_preeti_mondal', 'HOI275', 'Preeti Mondal', 'preeti.mondal@hoichoi.tv', 'requester', 'Associate - Employee Experience', 'Sushim Ranjan Dutta', '2026-01-01', true, '{}', 0),
  ('u_burhanuddin', 'HOI276', 'Burhanuddin Kherodawala', 'burhanuddin@hoichoi.tv', 'requester', 'AI Engineer', 'Mandar Banerjee', '2026-01-01', true, '{}', 0),
  ('u_kaustav_das', 'CON279', 'Kaustav Das', 'kaustav.das@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2026-01-05', true, '{}', 0),
  ('u_shirin', 'HOI277', 'Shirin Gupta', 'shirin@hoichoi.tv', 'creative_lead', 'Head - Talent Acquisition', 'Vishnu Kant Mohta', '2026-01-05', true, '{}', 0),
  ('u_geetopriya_saha', 'HOI278', 'Geetopriya Saha', 'geetopriya.saha@hoichoi.tv', 'requester', 'Management Trainee', 'Shreya Kaushik', '2026-01-05', true, '{}', 0),
  ('u_katib', 'HOI279', 'Katib Khan', 'katib@hoichoi.tv', 'requester', 'Senior Associate - Performance Marketing', 'Gunturu Sai Avinash', '2026-01-27', true, '{}', 0),
  ('u_aayush', 'HOI280', 'Aayush Kumar', 'aayush@hoichoi.tv', 'requester', 'Full Stack Developer', 'Mandar Banerjee', '2026-02-02', true, '{}', 0),
  ('u_niladri', 'HOI281', 'Niladri Haldar', 'niladri@hoichoi.tv', 'requester', 'Associate - VFX', 'Mandar Banerjee', '2026-02-02', true, '{}', 0),
  ('u_debarghya_mondal', 'HOI283', 'Debarghya Mondal', 'debarghya.mondal@hoichoi.tv', 'requester', 'Gen AI Promo Producer', 'Mandar Banerjee', '2026-02-05', true, '{}', 0),
  ('u_saptarshi_majumdar', 'HOI282', 'Saptarshi Majumdar', 'saptarshi.majumdar@hoichoi.tv', 'requester', 'Senior Executive Producer', 'Sera Banerjee', '2026-02-09', true, '{}', 0),
  ('u_shakshi_das', 'HOI284', 'Shakshi Das', 'shakshi.das@hoichoi.tv', 'video_editor', 'Video Editor', 'Arnab Bhattacharjee', '2026-02-24', true, '{}', 0)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  keka_id = EXCLUDED.keka_id,
  designation = EXCLUDED.designation,
  reports_to_name = EXCLUDED.reports_to_name,
  joined_at = EXCLUDED.joined_at,
  is_active = true,
  role = CASE WHEN users.role = 'creative_lead' THEN users.role ELSE EXCLUDED.role END;

UPDATE users SET is_active = false WHERE LOWER(email) NOT IN ('soumya.mukherjee@svf.in','sourav.ghosh@svf.in','salankara.biswas@hoichoi.tv','moloy@hoichoi.tv','sujit.sen@svf.in','aloke@svf.in','sandipan.mondal@hoichoi.tv','mandar.banerjee@hoichoi.tv','ruchita.chatterji@hoichoi.tv','sayantan.guha@hoichoi.tv','pratik.banerjee@hoichoi.tv','arnab.bhattacharjee@hoichoi.tv','shreya.kaushik@hoichoi.tv','mangaldeep.karmakar@hoichoi.tv','rajib@svf.in','debmalya.mukherjee@hoichoi.tv','nikhita.chatterjee@hoichoi.tv','sera.banerjee@hoichoi.tv','ipsita.mukherjee@hoichoi.tv','nitaichand.das@hoichoi.tv','sagnik.ghosh@hoichoi.tv','honey.agarwal@svf.in','debanjan.dasgupta@hoichoi.tv','gaurav.tyagi@hoichoi.tv','s.das@svf.in','ritika.das@hoichoi.tv','satyajit.maji@hoichoi.tv','pronay.roy@hoichoi.tv','ishani.bose@hoichoi.tv','anirban.jana@hoichoi.tv','pritam.ghosh@hoichoi.tv','sreya.dutta@hoichoi.tv','binay.bhowmick@hoichoi.tv','roshni.bose@hoichoi.tv','adhidev.mukherjee@hoichoi.tv','medha.mukherjee@svf.in','abhijan.chakraborty@hoichoi.tv','saswati.sinha@hoichoi.tv','rithuparna.ghosh@hoichoi.tv','anurag.ghosh@hoichoi.tv','sai.avinash@hoichoi.tv','sayantan.raha@hoichoi.tv','alokananda.sengupta@hoichoi.tv','akancha.pipalwa@hoichoi.tv','anwesha.debnath@hoichoi.tv','sarthak.dassharma@hoichoi.tv','soumi.banerjee@hoichoi.tv','diptesh.bhattacharya@hoichoi.tv','sushim.dutta@hoichoi.tv','debayani.panigrahi@hoichoi.tv','sambhav.khetrapal@hoichoi.tv','shoham.banerjee@hoichoi.tv','shinjini.nandy@hoichoi.tv','updesh@hoichoi.tv','sayan.maiti@hoichoi.tv','aranyak.chatterjee@hoichoi.tv','saswati.mitra@hoichoi.tv','arnab.neogi@hoichoi.tv','sougata.bhowmik@hoichoi.tv','ashish.mallik@hoichoi.tv','swarnavo.banerjee@hoichoi.tv','kapil.jain@hoichoi.tv','sayandeep.dey@hoichoi.tv','sumona.mondal@hoichoi.tv','shaket.banerjee@hoichoi.tv','amit.kumar@hoichoi.tv','shabinder.singh@hoichoi.tv','ishika.ganguly@hoichoi.tv','soumen.majumdar@hoichoi.tv','avinash.singh@hoichoi.tv','disha.roy@hoichoi.tv','boloram.mitra@hoichoi.tv','mayukh.das@hoichoi.tv','shantuno.chakraborty@hoichoi.tv','sreemoyee.banerjee@hoichoi.tv','shreya.paul@hoichoi.tv','gaurav.kuri@hoichoi.tv','sarani.deb@hoichoi.tv','gursevak.singh@hoichoi.tv','keerthana.anand@hoichoi.tv','preeti.mondal@hoichoi.tv','burhanuddin@hoichoi.tv','kaustav.das@hoichoi.tv','shirin@hoichoi.tv','geetopriya.saha@hoichoi.tv','katib@hoichoi.tv','aayush@hoichoi.tv','niladri@hoichoi.tv','debarghya.mondal@hoichoi.tv','saptarshi.majumdar@hoichoi.tv','shakshi.das@hoichoi.tv') AND is_active = true;
`;

const alterations = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_keka_id_key;
DROP INDEX IF EXISTS users_keka_id_unique;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_at DATE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS is_expedited BOOLEAN DEFAULT false;

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS linked_request_id TEXT;
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';
ALTER TABLE content_schedule ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS timesheet_clock (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  request_id TEXT REFERENCES requests(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const assetTypeMigration = `
UPDATE requests SET asset_type_id = 'scene_cutdown' WHERE asset_type_id = 'repurpose_reel';
UPDATE requests SET asset_type_id = 'teaser_first_look' WHERE asset_type_id = 'teaser_trailer';
UPDATE requests SET asset_type_id = 'hoichoi_brand_promo' WHERE asset_type_id = 'brand_promo';
UPDATE requests SET asset_type_id = 'branded_content_episode' WHERE asset_type_id = 'brand_episode_promo';
UPDATE requests SET asset_type_id = 'prebuzz_phase_ads' WHERE asset_type_id = 'prebuzz';
UPDATE requests SET asset_type_id = 'promo_phase_ads' WHERE asset_type_id = 'promo_video';
UPDATE requests SET asset_type_id = 'sustenance_phase_ads' WHERE asset_type_id = 'combined_ads';
UPDATE requests SET asset_type_id = 'library_content_ads' WHERE asset_type_id = 'scene_based_ads';
UPDATE requests SET asset_type_id = 'teaser_trailer_repackage' WHERE asset_type_id = 'trailer_repackages';
UPDATE requests SET asset_type_id = 'whatsapp_crm_video' WHERE asset_type_id = 'crm_promos';
UPDATE requests SET asset_type_id = 'teaser_first_look_thumb' WHERE asset_type_id = 'teaser_trailer_thumb';
UPDATE requests SET asset_type_id = 'ancillary_content_thumb' WHERE asset_type_id = 'promo_thumbnail';
UPDATE requests SET asset_type_id = 'super_cards_ext_influencers' WHERE asset_type_id = 'thumb_ext_influencers';
UPDATE requests SET asset_type_id = 'whatsapp_crm_static' WHERE asset_type_id = 'crm_static';
UPDATE requests SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_thumbnail';
UPDATE requests SET asset_type_id = 'sm_episode_thumbnail' WHERE asset_type_id = 'episode_thumbnail';
UPDATE requests SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_maintenance';

UPDATE deliverables SET asset_type_id = 'scene_cutdown' WHERE asset_type_id = 'repurpose_reel';
UPDATE deliverables SET asset_type_id = 'teaser_first_look' WHERE asset_type_id = 'teaser_trailer';
UPDATE deliverables SET asset_type_id = 'hoichoi_brand_promo' WHERE asset_type_id = 'brand_promo';
UPDATE deliverables SET asset_type_id = 'branded_content_episode' WHERE asset_type_id = 'brand_episode_promo';
UPDATE deliverables SET asset_type_id = 'prebuzz_phase_ads' WHERE asset_type_id = 'prebuzz';
UPDATE deliverables SET asset_type_id = 'promo_phase_ads' WHERE asset_type_id = 'promo_video';
UPDATE deliverables SET asset_type_id = 'sustenance_phase_ads' WHERE asset_type_id = 'combined_ads';
UPDATE deliverables SET asset_type_id = 'library_content_ads' WHERE asset_type_id = 'scene_based_ads';
UPDATE deliverables SET asset_type_id = 'teaser_trailer_repackage' WHERE asset_type_id = 'trailer_repackages';
UPDATE deliverables SET asset_type_id = 'whatsapp_crm_video' WHERE asset_type_id = 'crm_promos';
UPDATE deliverables SET asset_type_id = 'teaser_first_look_thumb' WHERE asset_type_id = 'teaser_trailer_thumb';
UPDATE deliverables SET asset_type_id = 'ancillary_content_thumb' WHERE asset_type_id = 'promo_thumbnail';
UPDATE deliverables SET asset_type_id = 'super_cards_ext_influencers' WHERE asset_type_id = 'thumb_ext_influencers';
UPDATE deliverables SET asset_type_id = 'whatsapp_crm_static' WHERE asset_type_id = 'crm_static';
UPDATE deliverables SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_thumbnail';
UPDATE deliverables SET asset_type_id = 'sm_episode_thumbnail' WHERE asset_type_id = 'episode_thumbnail';
UPDATE deliverables SET asset_type_id = 'cms_thumbnail_refresh' WHERE asset_type_id = 'cms_maintenance';
`;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(schema);
    await pool.query(alterations);
    await pool.query(assetTypeMigration);
    await pool.query(seedUsers);
    console.log('[migrate] Schema created successfully');
  } catch (err) {
    console.error('[migrate] Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  require('dotenv').config();
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate };
