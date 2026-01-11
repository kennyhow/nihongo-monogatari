// Kana data organized as explicit rows for maintainability
// Each row represents a consonant + vowel combination (a, i, u, e, o)
export const KANA_DATA = {
  hiragana: {
    basic: [
      { label: '', kana: ['あ', 'い', 'う', 'え', 'お'], romaji: ['a', 'i', 'u', 'e', 'o'] },
      { label: 'k', kana: ['か', 'き', 'く', 'け', 'こ'], romaji: ['ka', 'ki', 'ku', 'ke', 'ko'] },
      { label: 's', kana: ['さ', 'し', 'す', 'せ', 'そ'], romaji: ['sa', 'shi', 'su', 'se', 'so'] },
      {
        label: 't',
        kana: ['た', 'ち', 'つ', 'て', 'と'],
        romaji: ['ta', 'chi', 'tsu', 'te', 'to'],
      },
      { label: 'n', kana: ['な', 'に', 'ぬ', 'ね', 'の'], romaji: ['na', 'ni', 'nu', 'ne', 'no'] },
      { label: 'h', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'], romaji: ['ha', 'hi', 'fu', 'he', 'ho'] },
      { label: 'm', kana: ['ま', 'み', 'む', 'め', 'も'], romaji: ['ma', 'mi', 'mu', 'me', 'mo'] },
      { label: 'y', kana: ['や', null, 'ゆ', null, 'よ'], romaji: ['ya', null, 'yu', null, 'yo'] },
      { label: 'r', kana: ['ら', 'り', 'る', 'れ', 'ろ'], romaji: ['ra', 'ri', 'ru', 're', 'ro'] },
      { label: 'w', kana: ['わ', null, null, null, 'を'], romaji: ['wa', null, null, null, 'wo'] },
      { label: 'n', kana: ['ん', null, null, null, null], romaji: ['n', null, null, null, null] },
    ],
    dakuten: [
      { label: 'g', kana: ['が', 'ぎ', 'ぐ', 'げ', 'ご'], romaji: ['ga', 'gi', 'gu', 'ge', 'go'] },
      { label: 'z', kana: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'], romaji: ['za', 'ji', 'zu', 'ze', 'zo'] },
      { label: 'd', kana: ['だ', 'ぢ', 'づ', 'で', 'ど'], romaji: ['da', 'ji', 'zu', 'de', 'do'] },
      { label: 'b', kana: ['ば', 'び', 'ぶ', 'べ', 'ぼ'], romaji: ['ba', 'bi', 'bu', 'be', 'bo'] },
    ],
    handakuten: [
      { label: 'p', kana: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'], romaji: ['pa', 'pi', 'pu', 'pe', 'po'] },
    ],
  },
  katakana: {
    basic: [
      { label: '', kana: ['ア', 'イ', 'ウ', 'エ', 'オ'], romaji: ['a', 'i', 'u', 'e', 'o'] },
      { label: 'k', kana: ['カ', 'キ', 'ク', 'ケ', 'コ'], romaji: ['ka', 'ki', 'ku', 'ke', 'ko'] },
      { label: 's', kana: ['サ', 'シ', 'ス', 'セ', 'ソ'], romaji: ['sa', 'shi', 'su', 'se', 'so'] },
      {
        label: 't',
        kana: ['タ', 'チ', 'ツ', 'テ', 'ト'],
        romaji: ['ta', 'chi', 'tsu', 'te', 'to'],
      },
      { label: 'n', kana: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], romaji: ['na', 'ni', 'nu', 'ne', 'no'] },
      { label: 'h', kana: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'], romaji: ['ha', 'hi', 'fu', 'he', 'ho'] },
      { label: 'm', kana: ['マ', 'ミ', 'ム', 'メ', 'モ'], romaji: ['ma', 'mi', 'mu', 'me', 'mo'] },
      { label: 'y', kana: ['ヤ', null, 'ユ', null, 'ヨ'], romaji: ['ya', null, 'yu', null, 'yo'] },
      { label: 'r', kana: ['ラ', 'リ', 'ル', 'レ', 'ロ'], romaji: ['ra', 'ri', 'ru', 're', 'ro'] },
      { label: 'w', kana: ['ワ', null, null, null, 'ヲ'], romaji: ['wa', null, null, null, 'wo'] },
      { label: 'n', kana: ['ン', null, null, null, null], romaji: ['n', null, null, null, null] },
    ],
    dakuten: [
      { label: 'g', kana: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'], romaji: ['ga', 'gi', 'gu', 'ge', 'go'] },
      { label: 'z', kana: ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'], romaji: ['za', 'ji', 'zu', 'ze', 'zo'] },
      { label: 'd', kana: ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'], romaji: ['da', 'ji', 'zu', 'de', 'do'] },
      { label: 'b', kana: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'], romaji: ['ba', 'bi', 'bu', 'be', 'bo'] },
    ],
    handakuten: [
      { label: 'p', kana: ['パ', 'ピ', 'プ', 'ペ', 'ポ'], romaji: ['pa', 'pi', 'pu', 'pe', 'po'] },
    ],
  },
};
