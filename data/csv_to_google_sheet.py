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

# 3. Build the credentials dictionary from .env variables
credentials_dict = {
    "type": os.getenv("GOOGLE_TYPE"),
    "project_id": os.getenv("GOOGLE_PROJECT_ID"),
    "private_key_id": os.getenv("GOOGLE_PRIVATE_KEY_ID"),
    # Replace escaped '\\n' from .env into actual newlines '\n'
    "private_key": os.getenv("GOOGLE_PRIVATE_KEY", "").replace("\\n", "\n"),
    "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
    "auth_uri": os.getenv("GOOGLE_AUTH_URI"),
    "token_uri": os.getenv("GOOGLE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv(
        "GOOGLE_AUTH_PROVIDER_X509_CERT_URL"
    ),
    "client_x509_cert_url": os.getenv("GOOGLE_CLIENT_X509_CERT_URL"),
    "universe_domain": os.getenv("GOOGLE_UNIVERSE_DOMAIN"),
}

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