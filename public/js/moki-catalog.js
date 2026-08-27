/* MOKI catalog - single source of truth for character parts.
   Loaded as a global in the browser AND require()d by the Node server,
   so the server can validate every cosmetic a client claims to wear. */
(function (root, factory) {
  var C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  root.MOKI_CATALOG = C;
})(typeof self !== 'undefined' ? self : this, function () {

  // lvl = level required to unlock (0 = available from the start)
  return {
    skin: [
      { id: 'sand',   name: 'Sand',   c: '#F7D2AE', lvl: 0 },
      { id: 'peach',  name: 'Peach',  c: '#F0B48C', lvl: 0 },
      { id: 'clay',   name: 'Clay',   c: '#D08A5C', lvl: 0 },
      { id: 'cocoa',  name: 'Cocoa',  c: '#9A5B33', lvl: 0 },
      { id: 'umber',  name: 'Umber',  c: '#6B3B22', lvl: 0 },
      { id: 'mint',   name: 'Mint',   c: '#8FE3C2', lvl: 2 },
      { id: 'berry',  name: 'Berry',  c: '#E39BD8', lvl: 4 },
      { id: 'robot',  name: 'Chrome', c: '#C9D4E4', lvl: 7 }
    ],
    hair: [
      { id: 'bald',   name: 'Smooth',   lvl: 0 },
      { id: 'short',  name: 'Short',    lvl: 0 },
      { id: 'puff',   name: 'Puff',     lvl: 0 },
      { id: 'long',   name: 'Long',     lvl: 0 },
      { id: 'spiky',  name: 'Spiky',    lvl: 1 },
      { id: 'bun',    name: 'Top Bun',  lvl: 2 },
      { id: 'curls',  name: 'Curls',    lvl: 3 },
      { id: 'mohawk', name: 'Mohawk',   lvl: 5 }
    ],
    hairColor: [
      { id: 'ink',    name: 'Ink',    c: '#2B2440', lvl: 0 },
      { id: 'brown',  name: 'Brown',  c: '#7A4A24', lvl: 0 },
      { id: 'blonde', name: 'Blonde', c: '#F2C94C', lvl: 0 },
      { id: 'ginger', name: 'Ginger', c: '#E2703A', lvl: 0 },
      { id: 'plum',   name: 'Plum',   c: '#8B3FA8', lvl: 1 },
      { id: 'aqua',   name: 'Aqua',   c: '#25C6C6', lvl: 3 },
      { id: 'hot',    name: 'Hot Pink', c: '#FF4FA3', lvl: 4 },
      { id: 'lime',   name: 'Lime',   c: '#8BE04E', lvl: 6 }
    ],
    eyes: [
      { id: 'dot',    name: 'Dots',   lvl: 0 },
      { id: 'big',    name: 'Big',    lvl: 0 },
      { id: 'happy',  name: 'Happy',  lvl: 0 },
      { id: 'sleepy', name: 'Sleepy', lvl: 1 },
      { id: 'wink',   name: 'Wink',   lvl: 2 },
      { id: 'star',   name: 'Stars',  lvl: 5 },
      { id: 'fierce', name: 'Fierce', lvl: 4 },
      { id: 'heart',  name: 'Hearts', lvl: 6 },
      { id: 'swirl',  name: 'Dizzy',  lvl: 8 }
    ],
    mouth: [
      { id: 'smile',  name: 'Smile',  lvl: 0 },
      { id: 'grin',   name: 'Grin',   lvl: 0 },
      { id: 'oh',     name: 'Whoa',   lvl: 0 },
      { id: 'smirk',  name: 'Smirk',  lvl: 1 },
      { id: 'tongue', name: 'Tongue', lvl: 3 },
      { id: 'fang',   name: 'Fang',   lvl: 6 },
      { id: 'gasp',   name: 'Gasp',   lvl: 2 },
      { id: 'kitty',  name: 'Kitty',  lvl: 5 }
    ],
    outfit: [
      { id: 'tee-red',    name: 'Red Tee',    c: '#FF5A5F', deco: 'none',   lvl: 0 },
      { id: 'tee-blue',   name: 'Blue Tee',   c: '#3B82F6', deco: 'none',   lvl: 0 },
      { id: 'tee-green',  name: 'Green Tee',  c: '#22C55E', deco: 'none',   lvl: 0 },
      { id: 'stripe',     name: 'Stripes',    c: '#FFB020', deco: 'stripe', lvl: 1 },
      { id: 'hoodie',     name: 'Hoodie',     c: '#7C5CFF', deco: 'hood',   lvl: 2 },
      { id: 'star',       name: 'Star Top',   c: '#EC4899', deco: 'star',   lvl: 4 },
      { id: 'overalls',   name: 'Overalls',   c: '#2563EB', deco: 'strap',  lvl: 6 },
      { id: 'space',      name: 'Spacesuit',  c: '#E2E8F0', deco: 'space',  lvl: 9 }
    ],
    pants: [
      { id: 'jeans',  name: 'Jeans',  c: '#3E5C8A', lvl: 0 },
      { id: 'shorts', name: 'Shorts', c: '#F97316', lvl: 0 },
      { id: 'dark',   name: 'Black',  c: '#31313F', lvl: 0 },
      { id: 'khaki',  name: 'Khaki',  c: '#C2A878', lvl: 1 },
      { id: 'candy',  name: 'Candy',  c: '#FF7AB6', lvl: 3 },
      { id: 'neon',   name: 'Neon',   c: '#A3E635', lvl: 7 }
    ],
    shoes: [
      { id: 'sneak',  name: 'Sneakers', c: '#FFFFFF', lvl: 0 },
      { id: 'boots',  name: 'Boots',    c: '#6B4423', lvl: 0 },
      { id: 'red',    name: 'Red Kicks',c: '#EF4444', lvl: 0 },
      { id: 'aqua',   name: 'Aqua',     c: '#22D3EE', lvl: 2 },
      { id: 'gold',   name: 'Gold',     c: '#FBBF24', lvl: 5 },
      { id: 'rocket', name: 'Rockets',  c: '#94A3B8', lvl: 8 }
    ],
    hat: [
      { id: 'none',   name: 'No Hat',   lvl: 0 },
      { id: 'cap',    name: 'Cap',      c: '#EF4444', lvl: 0 },
      { id: 'beanie', name: 'Beanie',   c: '#7C5CFF', lvl: 1 },
      { id: 'party',  name: 'Party',    c: '#F472B6', lvl: 2 },
      { id: 'crown',  name: 'Crown',    c: '#FBBF24', lvl: 5 },
      { id: 'wizard', name: 'Wizard',   c: '#4F46E5', lvl: 7 },
      { id: 'helmet', name: 'Helmet',   c: '#38BDF8', lvl: 10 },
      { id: 'flower', name: 'Flower',   c: '#FB7185', lvl: 3 },
      { id: 'halo',   name: 'Halo',     c: '#FDE68A', lvl: 9 },
      { id: 'horns',  name: 'Horns',    c: '#EF4444', lvl: 11 }
    ],
    accessory: [
      { id: 'none',    name: 'None',        lvl: 0 },
      { id: 'glasses', name: 'Glasses',     lvl: 0 },
      { id: 'shades',  name: 'Shades',      lvl: 1 },
      { id: 'blush',   name: 'Blush',       lvl: 2 },
      { id: 'freckle', name: 'Freckles',    lvl: 3 },
      { id: 'scarf',   name: 'Scarf',       lvl: 4 },
      { id: 'headset', name: 'Headset',     lvl: 8 },
      { id: 'bowtie',  name: 'Bow Tie',     lvl: 2 },
      { id: 'mask',    name: 'Hero Mask',   lvl: 6 },
      { id: 'monocle', name: 'Monocle',     lvl: 9 }
    ],
    aura: [
      { id: 'none',    name: 'None',      lvl: 0 },
      { id: 'glow',    name: 'Soft Glow', c: '#FFD86B', lvl: 1 },
      { id: 'sparkle', name: 'Sparkles',  c: '#FFF06B', lvl: 3 },
      { id: 'bubbles', name: 'Bubbles',   c: '#7DD3FC', lvl: 5 },
      { id: 'flames',  name: 'Flames',    c: '#FB923C', lvl: 7 },
      { id: 'stars',   name: 'Stardust',  c: '#C4B5FD', lvl: 9 },
      { id: 'rainbow', name: 'Rainbow',   c: '#F472B6', lvl: 12 }
    ]
  };
});