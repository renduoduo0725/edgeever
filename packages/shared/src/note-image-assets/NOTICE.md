# Note image typography and textures

Card typography uses Alibaba PuHuiTi 3.0 Regular (Alibaba / Hanyi), MiSans Regular (Xiaomi / Hanyi), Source Han Serif CN SemiBold (Adobe), Huiwen Mingchao (天王帝廷), Long Cang (LongCang project authors), and Geist Mono (Vercel).

The WOFF2 subsets are byte-for-byte copies of the public reference resources; their original copyright metadata and Unicode ranges are preserved in each `SOURCE.css`. Only Geist Mono and a shared Noto Sans SC fallback are bundled in clients. Other template subsets are downloaded from immutable repository URLs when needed and cached locally; the application only requests subsets covering the card's text. Failed or slow downloads fall back to local fonts without changing the saved font choice. It does not modify the font outlines. MiSans is used in the memo card template.

Sources and notices:

- Alibaba: https://www.alibabafonts.com/ — original declaration https://www.yuque.com/yiguang-wkqc2/puhuiti/nus9wiinq4aeiegy ; a reproduced declaration is retained in `puhui/LICENSE.md` with its source attribution.
- MiSans: https://hyperos.mi.com/font/ — agreement retained in `misans/LICENSE.pdf`.
- Source Han Serif: https://github.com/adobe-fonts/source-han-serif — `song/LICENSE.txt` (SIL OFL).
- Huiwen Mingchao: author introduction https://zhuanlan.zhihu.com/p/344103391 ; the original font's Public Domain metadata is retained in `mincho/SOURCE.css`.
- Long Cang: https://github.com/googlefonts/longcang — `longcang/OFL.txt`.
- Geist Mono: https://github.com/google/fonts/tree/main/ofl/geistmono — `geist/OFL.txt`.
- Reference typography subsets: https://fireflycard.shushiai.com/font/ (Alibaba-PuHuiTi-Regular, misansRegular, sourceHanSerifSemiBold, huiwenmingchao, longCang).
- Paper layers: https://fireflycard.shushiai.com/_nuxt/abrazine-back.Cn8TMtqS.png and https://fireflycard.shushiai.com/_nuxt/write-text.BDxN5rcD.png . These are reference paper assets, not generated noise.

Keep these notices with distributed application resources. Font and reference brand ownership remain with their respective owners.
