# /// script
# dependencies = [
#     "requests",
#     "pandas",
# ]
# ///

import pandas as pd
import requests

# 1. Récupération des députés actifs de l'Assemblée nationale
URL_TRIC = "https://parlement.tricoteuses.fr"
response = requests.get(
    f"{URL_TRIC}/v2/acteurs",
    params={"perPage": 600, "chambre": "AN", "actif": "true"},
    timeout=30,
)
response.raise_for_status()

deputes = pd.json_normalize(response.json()["data"])
deputes = deputes.rename(
    columns={
        "uid": "id",
        "groupeParlementaire.libelle": "groupe",
        "groupeParlementaire.libelleAbrege": "groupeAbrev",
        "circonscription.numCirco": "circo",
        "circonscription.numDepartement": "dep",
    }
)
deputes = deputes.dropna(subset=["circo"])
deputes = deputes[[
    "id",
    "nom",
    "prenom",
    "groupe",
    "groupeAbrev",
    "circo",
    "dep",
    "compteBluesky",
]]


# 2. Récupération et filtrage des contacts électroniques
res_contacts = requests.get(
    f"{URL_TRIC}/adressesElectroniques/json", params={"perPage": 10000}, timeout=30
)
res_contacts.raise_for_status()

contacts = pd.json_normalize(res_contacts.json()["data"])
contacts = contacts.dropna(subset=["valElec"])
contacts = contacts.rename(columns={"acteurRefUid": "id", "valElec": "valeur"})

# Sélection des colonnes utiles, nettoyage et filtrage des emails officiels
contacts = contacts[["uid", "id", "typeLibelle", "valeur"]]
contacts["valeur"] = contacts["valeur"].str.strip()
contacts = contacts.drop_duplicates(subset=["valeur"])

mask = (contacts["typeLibelle"] != "Mèl") | (
    (contacts["typeLibelle"] == "Mèl")
    & (contacts["valeur"].str.endswith("assemblee-nationale.fr", na=False))
)
contacts = contacts[mask]


# 3. Pivotement de la table contacts pour passer d'un format long à un format large (1 ligne par député)
contacts_pivot = contacts.pivot_table(
    index="id",
    columns="typeLibelle",
    values="valeur",
    aggfunc=lambda x: "; ".join(x.astype(str)),
).reset_index()

# Nettoyage du nom de l'index des colonnes
contacts_pivot.columns.name = None


# 4. Fusion (merge) entre les députés et leurs contacts pivotés
depute_et_cont = deputes.merge(
    contacts_pivot, on="id", how="left", suffixes=("_depute", "_contact")
)
depute_et_cont = depute_et_cont.rename(columns={"Mèl": "E-mail officiel"})


# 5. Export final en CSV
depute_et_cont.to_csv("deputes_et_contactes_tricouteuse.csv", index=False)

print(f"Fichier exporté avec succès ! Dimensions : {depute_et_cont.shape}")