import json
import os

METADATA_FOLDER = r"C:\Users\Pc\Desktop\ARC_PUNKS_10K\metadata"

# Les 10 CID dans l'ordre (Batch1 à Batch10)
BATCH_CIDS = [
    "bafybeiexlv7oe7ndparerxazwra6z2b2vibmxuyhynst76o5huyjklrn2u",  # Batch1 (1-1000)
    "bafybeibevbt65n2jyukczj3nexeajdw3njaisr6a5hjqwcz6uwaarbnhgi",  # Batch2 (1001-2000)
    "bafybeiauuc7ui6oyniwjx5ry3j4gjbtn4boqd7leqbeqiowtx5oixcnk2u",  # Batch3 (2001-3000)
    "bafybeic6vttsyb2u7uzlqrwohbyrarfsyvbn6zrc6yszfmc6lmrbzypepe",  # Batch4 (3001-4000)
    "bafybeibh55cyhptuvnooy2ahnkcc3awtekfxai5fhnb6v5z3lz3gmasjhm",  # Batch5 (4001-5000)
    "bafybeid7znnldvv45nbeyhb4fobrd4sh4urps5h4lb65slgmoyynu3gpx4",  # Batch6 (5001-6000)
    "bafybeichtgfthfpptka4ufjpeymns2v6edp2vp35w5j5aricgommmrkoxa",  # Batch7 (6001-7000)
    "bafybeieqtoiou5tn72o2q6t4es34xcldmuikvukfbdnqhilv6nttokd7bq",  # Batch8 (7001-8000)
    "bafybeiccvldo67yeh6ptx2ljf772n6pb3fq6espsropngnhaq2uefrrg6u",  # Batch9 (8001-9000)
    "bafybeichdojmksvi2zyc6uuosf5kzy7qsj6bessrjzgzlzaymqvkqjdid4",  # Batch10 (9001-10000)
]

BATCH_SIZE = 1000
updated_count = 0
errors = []

for token_id in range(1, 10001):
    batch_index = (token_id - 1) // BATCH_SIZE
    cid = BATCH_CIDS[batch_index]

    json_path = os.path.join(METADATA_FOLDER, f"{token_id}.json")

    if not os.path.exists(json_path):
        errors.append(f"Fichier manquant : {token_id}.json")
        continue

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["image"] = f"ipfs://{cid}/{token_id}.png"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        updated_count += 1
    except Exception as e:
        errors.append(f"Erreur sur {token_id}.json : {e}")

print(f"\n✅ {updated_count} fichiers mis à jour avec succès")
if errors:
    print(f"⚠️ {len(errors)} erreurs :")
    for err in errors[:10]:
        print(f"  - {err}")
    if len(errors) > 10:
        print(f"  ... et {len(errors) - 10} autres")