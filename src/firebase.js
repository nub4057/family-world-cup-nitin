// Firebase initialization. Paste the config object from your Firebase project
// (Project settings → Your apps → the </> web app) into firebaseConfig below.
//
// This file is safe to commit — Firebase web config values are not secret;
// access is controlled by your Realtime Database security rules instead
// (see README.md for the recommended rules).

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  databaseURL: "https://REPLACE_ME-default-rtdb.firebaseio.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
