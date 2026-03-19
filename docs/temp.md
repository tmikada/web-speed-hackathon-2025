base64 -w 0 subset.woff2 > subset.txt
echo "src: url('data:font/woff2;base64,$(base64 -w 0 subset.woff2)') format('woff2');" | clip.exe



echo "src: url('data:font/woff2;base64,$(base64 -w 0 subset.woff2)') format('woff2');"


pyftsubset mushin.otf   --text="アニメ"   --flavor=woff2   --output-file=subset.woff2

pyftsubset Manabiya-SAKURA.otf   --text="ドキュメンタリー"   --flavor=woff2   --output-file=subset.woff2

pyftsubset mushin.otf   --text="ドラマ"   --flavor=woff2   --output-file=subset.woff2

pyftsubset kurobara-gothic-medium.ttf   --text="格闘"   --flavor=woff2   --output-file=subset.woff2

pyftsubset memoir.otf   --text="リアリティショー"   --flavor=woff2   --output-file=subset.woff2


Get-ChildItem images\*.jpeg | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -vf scale=1280:-1 `
    -q:v 2 -map_metadata 0 -threads 0 `
    "images-1280\$($_.Name)"
}

Get-ChildItem images-resized\*.webp | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -c:v libwebp `
    -quality 75 `
    -compression_level 6 `
    "images-resized2\$($_.BaseName).webp"
}

Get-ChildItem images-resized\*.webp | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -c:v libwebp `
    -quality 65 `
    -compression_level 6 `
    "images-resized2\$($_.BaseName).webp"
}

Get-ChildItem images-resized\011*.webp | ForEach-Object {
  ffmpeg -i "$($_.FullName)" `
    -c:v libwebp `
    -quality 65 `
    -compression_level 6 `
    "images-resized2\$($_.BaseName).webp"
}

  ffmpeg -i "images-resized\011.webp" `
    -c:v libwebp `
    -quality 75 `
    -compression_level 6 `