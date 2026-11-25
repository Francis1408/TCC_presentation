from pathlib import Path

# Replace with the path to your folder
folder = Path("static/images/dataset_seed")

for file in folder.iterdir():
  # Check if it's a file and contains "snap" in its name (without extension)
  if file.is_file() and "snap" in file.stem:
    new_stem = file.stem.replace("snapped", "palette-snapped")
    new_path = file.with_name(f"{new_stem}{file.suffix}")

    file.rename(new_path)
    print(f"Renamed: {file.name} -> {new_path.name}")