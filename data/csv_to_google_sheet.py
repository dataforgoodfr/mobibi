# /// script
# dependencies = [
#     "pandas",
#     "gspread",
#     "google-auth",
# ]
# ///

import gspread
import pandas as pd

# === 1. Saisie interactive des paramètres ===
csv_path = (
    input(
        "Chemin du fichier CSV [deputes_et_contactes_tricouteuse.csv] : "
    ).strip()
    or "deputes_et_contactes_tricouteuse.csv"
)

sheet_name = (
    input("Nom ou URL du Google Sheet [mobibi_test] : ").strip()
    or "mobibi_test"
)

credentials_path = (
    input(
        "Chemin vers le fichier credentials JSON [credentials.json] : "
    ).strip()
    or "credentials.json"
)

# === 2. Lecture du fichier CSV ===
print(f"\nLecture du fichier CSV : {csv_path}...")
df = pd.read_csv(csv_path)

# Remplacement des valeurs NaN par des chaînes vides
df = df.fillna("")

# === 3. Connexion à Google Sheets ===
print("Connexion à Google Sheets...")
gc = gspread.service_account(filename=credentials_path)

# === 4. Ouverture de la feuille (support du nom ou de l'URL) ===
if sheet_name.startswith("http://") or sheet_name.startswith("https://"):
  sh = gc.open_by_url(sheet_name)
else:
  sh = gc.open(sheet_name)

worksheet = sh.get_worksheet(0)

# === 5. Envoi des données ===
print(f"Envoi des données vers le Google Sheet '{sh.title}'...")
worksheet.clear()
worksheet.update([df.columns.values.tolist()] + df.values.tolist())

print("Importation réussie avec succès !")