# /// script
# dependencies = [
#     "pandas",
#     "gspread",
#     "google-auth",
#     "python-dotenv",
# ]
# ///

import argparse
import os
from dotenv import load_dotenv
import gspread
import pandas as pd
import json

# 1. Load environment variables from the .env file
load_dotenv()

# 2. Set up command-line arguments
parser = argparse.ArgumentParser(
    description="Envoyer un fichier CSV vers Google Sheets."
)
parser.add_argument(
    "--csv_path",
    default="deputes_et_contactes_tricouteuse.csv",
    help="Chemin vers le fichier CSV à importer",
)
parser.add_argument(
    "--sheet_name",
    default="mobibi_test",
    help="Nom du Google Sheet de destination",
)
args = parser.parse_args()

# 3. Parse the JSON string directly into a dictionary
credentials_dict = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])

# 4. Read the CSV file using the CLI argument
print(f"Lecture du fichier CSV : {args.csv_path}...")
df = pd.read_csv(args.csv_path)
df = df.fillna("")


# 5. Connect to Google Sheets using the dictionary
print("Connexion à Google Sheets...")
gc = gspread.service_account_from_dict(credentials_dict)

# 6. Send data to Google Sheets
sh = gc.open(args.sheet_name)
worksheet = sh.get_worksheet(0)

print(f"Envoi des données vers le Google Sheet '{args.sheet_name}'...")
worksheet.clear()
worksheet.update([df.columns.values.tolist()] + df.values.tolist())

print("Importation réussie avec succès !")