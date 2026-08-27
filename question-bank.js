'use strict';
/* MOKI Spark - a completely offline question generator.
   No external service, no API key, no cost. It matches the host's typed
   topic against a built-in bank using loose keyword matching, then shuffles
   both the question order and the answer positions. If nothing matches it
   returns an empty list and the creator falls back to manual entry. */

const BANK = {
  science: {
    keys: ['science', 'biology', 'chemistry', 'physics', 'lab', 'scientific'],
    q: [
      ['What gas do plants absorb from the air to make food?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
      ['What is the chemical symbol for water?', 'H2O', 'CO2', 'NaCl', 'O2'],
      ['How many bones are in the adult human body?', '206', '186', '256', '150'],
      ['What force keeps planets in orbit around the Sun?', 'Gravity', 'Magnetism', 'Friction', 'Tension'],
      ['What part of the cell contains DNA?', 'The nucleus', 'The ribosome', 'The membrane', 'The vacuole'],
      ['What is the hardest natural substance on Earth?', 'Diamond', 'Granite', 'Steel', 'Quartz'],
      ['At what temperature does water boil at sea level?', '100 degrees C', '90 degrees C', '80 degrees C', '120 degrees C'],
      ['Which blood cells fight infection?', 'White blood cells', 'Red blood cells', 'Platelets', 'Plasma cells']
    ]
  },
  space: {
    keys: ['space', 'astronomy', 'planet', 'universe', 'nasa', 'galaxy', 'solar'],
    q: [
      ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
      ['What is the closest star to Earth?', 'The Sun', 'Proxima Centauri', 'Sirius', 'Polaris'],
      ['Which planet has the most prominent ring system?', 'Saturn', 'Neptune', 'Uranus', 'Jupiter'],
      ['What galaxy is our solar system in?', 'The Milky Way', 'Andromeda', 'Triangulum', 'Sombrero'],
      ['Who was the first human to walk on the Moon?', 'Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
      ['What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
      ['What do we call a star that suddenly explodes?', 'A supernova', 'A quasar', 'A pulsar', 'A nebula'],
      ['Roughly how long does light from the Sun take to reach Earth?', 'About 8 minutes', 'About 8 seconds', 'About 8 hours', 'Instantly']
    ]
  },
  history: {
    keys: ['history', 'historical', 'ancient', 'war', 'empire', 'past'],
    q: [
      ['In which country were the ancient pyramids of Giza built?', 'Egypt', 'Greece', 'Mexico', 'Iraq'],
      ['Which wall divided a European city until 1989?', 'The Berlin Wall', 'Hadrian s Wall', 'The Great Wall', 'The Western Wall'],
      ['Who was the first President of the United States?', 'George Washington', 'Thomas Jefferson', 'John Adams', 'Abraham Lincoln'],
      ['The Titanic sank in which year?', '1912', '1905', '1920', '1898'],
      ['Which ancient civilisation built Machu Picchu?', 'The Inca', 'The Maya', 'The Aztec', 'The Olmec'],
      ['World War II ended in which year?', '1945', '1939', '1918', '1950'],
      ['Which empire was ruled from Rome?', 'The Roman Empire', 'The Ottoman Empire', 'The Mongol Empire', 'The Mughal Empire'],
      ['Who wrote the Indian Constitution s drafting committee report as chairman?', 'B. R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Patel', 'Rajendra Prasad']
    ]
  },
  geography: {
    keys: ['geography', 'country', 'countries', 'capital', 'world', 'map', 'city'],
    q: [
      ['What is the longest river in the world?', 'The Nile', 'The Amazon', 'The Yangtze', 'The Danube'],
      ['Which is the largest ocean?', 'The Pacific', 'The Atlantic', 'The Indian', 'The Arctic'],
      ['What is the capital city of Japan?', 'Tokyo', 'Kyoto', 'Osaka', 'Seoul'],
      ['Mount Everest sits on the border of Nepal and which country?', 'China', 'India', 'Bhutan', 'Pakistan'],
      ['Which continent is the Sahara Desert in?', 'Africa', 'Asia', 'Australia', 'South America'],
      ['What is the smallest country in the world?', 'Vatican City', 'Monaco', 'Malta', 'San Marino'],
      ['Which country has the most people?', 'India', 'China', 'USA', 'Indonesia'],
      ['The Great Barrier Reef lies off the coast of which country?', 'Australia', 'Brazil', 'Thailand', 'Mexico']
    ]
  },
  animals: {
    keys: ['animal', 'animals', 'wildlife', 'nature', 'zoo', 'creature'],
    q: [
      ['What is the largest land animal?', 'The African elephant', 'The rhinoceros', 'The giraffe', 'The hippo'],
      ['Which bird cannot fly?', 'The penguin', 'The eagle', 'The sparrow', 'The parrot'],
      ['How many legs does a spider have?', 'Eight', 'Six', 'Ten', 'Four'],
      ['What is the fastest land animal?', 'The cheetah', 'The lion', 'The horse', 'The greyhound'],
      ['Which animal is known as the king of the jungle?', 'The lion', 'The tiger', 'The bear', 'The gorilla'],
      ['What do you call a baby kangaroo?', 'A joey', 'A cub', 'A kit', 'A calf'],
      ['Which sea creature has three hearts?', 'The octopus', 'The dolphin', 'The shark', 'The jellyfish'],
      ['What is a group of lions called?', 'A pride', 'A pack', 'A herd', 'A flock']
    ]
  },
  sports: {
    keys: ['sport', 'sports', 'football', 'cricket', 'olympic', 'game day', 'athletics'],
    q: [
      ['How many players are on a football (soccer) team on the pitch?', 'Eleven', 'Nine', 'Ten', 'Twelve'],
      ['How often are the Summer Olympic Games normally held?', 'Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years'],
      ['In cricket, how many runs is a ball hit over the boundary without bouncing?', 'Six', 'Four', 'Five', 'Three'],
      ['Which sport uses a shuttlecock?', 'Badminton', 'Tennis', 'Squash', 'Table tennis'],
      ['How many points is a standard basketball field goal inside the arc?', 'Two', 'One', 'Three', 'Four'],
      ['In tennis, what is a score of zero called?', 'Love', 'Nil', 'Duck', 'Blank'],
      ['How many holes are played in a full round of golf?', 'Eighteen', 'Nine', 'Twelve', 'Twenty'],
      ['Which country hosted the first modern Olympic Games?', 'Greece', 'France', 'Italy', 'England']
    ]
  },
  technology: {
    keys: ['tech', 'technology', 'computer', 'coding', 'programming', 'internet', 'software', 'ai'],
    q: [
      ['What does CPU stand for?', 'Central Processing Unit', 'Computer Power Unit', 'Control Program Utility', 'Central Print Unit'],
      ['Which language is mainly used to style web pages?', 'CSS', 'HTML', 'Python', 'SQL'],
      ['What does WWW stand for?', 'World Wide Web', 'Wide World Web', 'Web Wide World', 'World Web Wire'],
      ['How many bits are in a byte?', 'Eight', 'Four', 'Sixteen', 'Two'],
      ['What does HTTP mostly transfer?', 'Web pages', 'Electricity', 'Radio waves', 'Printer ink'],
      ['Which company created the Android operating system originally?', 'Android Inc.', 'Apple', 'Microsoft', 'Nokia'],
      ['What kind of memory is lost when a computer is switched off?', 'RAM', 'Hard disk', 'SSD', 'ROM'],
      ['What symbol starts a typical email address domain?', 'The @ sign', 'The # sign', 'The & sign', 'The % sign']
    ]
  },
  movies: {
    keys: ['movie', 'movies', 'film', 'cinema', 'hollywood', 'bollywood', 'tv', 'show'],
    q: [
      ['Which film features a character named Simba?', 'The Lion King', 'Madagascar', 'Zootopia', 'Tarzan'],
      ['What colour is the ogre Shrek?', 'Green', 'Blue', 'Grey', 'Purple'],
      ['In which film would you find the ship RMS Titanic sinking as the main plot?', 'Titanic', 'Poseidon', 'The Abyss', 'Life of Pi'],
      ['Which superhero is also called the Dark Knight?', 'Batman', 'Superman', 'Iron Man', 'Thor'],
      ['What is the name of the toy cowboy in Toy Story?', 'Woody', 'Buzz', 'Rex', 'Hamm'],
      ['Which award is a golden statuette given for film excellence?', 'The Oscar', 'The Grammy', 'The Emmy', 'The Tony'],
      ['In Finding Nemo, what kind of fish is Nemo?', 'A clownfish', 'A goldfish', 'A shark', 'A tuna'],
      ['Which wizard school does Harry Potter attend?', 'Hogwarts', 'Beauxbatons', 'Durmstrang', 'Ilvermorny']
    ]
  },
  music: {
    keys: ['music', 'song', 'songs', 'band', 'singer', 'instrument'],
    q: [
      ['How many strings does a standard guitar have?', 'Six', 'Four', 'Five', 'Seven'],
      ['Which instrument has black and white keys?', 'The piano', 'The violin', 'The flute', 'The drum'],
      ['How many notes are in a standard musical octave scale?', 'Eight', 'Five', 'Ten', 'Twelve'],
      ['What do you call a group of four singers?', 'A quartet', 'A duet', 'A trio', 'A quintet'],
      ['Which instrument is played with a bow?', 'The violin', 'The trumpet', 'The clarinet', 'The tuba'],
      ['What does the term tempo describe?', 'Speed of the music', 'Loudness', 'Pitch', 'Instrument type'],
      ['Which family does the saxophone belong to?', 'Woodwind', 'Brass', 'Percussion', 'String'],
      ['What is a very loud dynamic marking called?', 'Fortissimo', 'Pianissimo', 'Moderato', 'Legato']
    ]
  },
  maths: {
    keys: ['math', 'maths', 'mathematics', 'numbers', 'arithmetic', 'algebra', 'school'],
    q: [
      ['What is 7 times 8?', '56', '54', '64', '48'],
      ['How many degrees are in a right angle?', '90', '45', '180', '360'],
      ['What is the value of pi to two decimal places?', '3.14', '3.41', '2.14', '3.12'],
      ['What do you call a shape with five sides?', 'A pentagon', 'A hexagon', 'A square', 'An octagon'],
      ['What is 15 percent of 200?', '30', '25', '35', '20'],
      ['What is the square root of 144?', '12', '14', '11', '16'],
      ['How many sides does a triangle have?', 'Three', 'Four', 'Two', 'Five'],
      ['What is the next prime number after 7?', '11', '9', '10', '13']
    ]
  },
  gaming: {
    keys: ['gaming', 'games', 'video game', 'esports', 'console', 'minecraft'],
    q: [
      ['In Minecraft, what material do you need to make a torch besides a stick?', 'Coal', 'Iron', 'Gold', 'Clay'],
      ['What is the name of the green plumber-adjacent character in a red hat from Nintendo?', 'Mario', 'Link', 'Kirby', 'Samus'],
      ['Which company makes the PlayStation console?', 'Sony', 'Microsoft', 'Nintendo', 'Sega'],
      ['In chess, which piece can only move diagonally?', 'The bishop', 'The rook', 'The knight', 'The pawn'],
      ['What does FPS commonly stand for in games?', 'First person shooter', 'Fast play system', 'Full power state', 'Final phase score'],
      ['How many squares are on a standard chessboard?', '64', '81', '49', '100'],
      ['Which game features a battle royale island with 100 players?', 'Fortnite', 'Tetris', 'Pac-Man', 'Pong'],
      ['What colour are the ghosts chasing Pac-Man not usually?', 'Green', 'Red', 'Pink', 'Orange']
    ]
  },
  general: {
    keys: ['general', 'trivia', 'random', 'mixed', 'quiz', 'fun'],
    q: [
      ['How many days are in a leap year?', '366', '365', '364', '367'],
      ['What colour do you get by mixing blue and yellow?', 'Green', 'Purple', 'Orange', 'Brown'],
      ['How many continents are there?', 'Seven', 'Five', 'Six', 'Eight'],
      ['What is the largest mammal on Earth?', 'The blue whale', 'The elephant', 'The giraffe', 'The polar bear'],
      ['How many minutes are in a full day?', '1440', '1200', '1600', '2400'],
      ['What is the freezing point of water in Celsius?', '0 degrees', '32 degrees', '10 degrees', '-10 degrees'],
      ['Which sense do the eyes provide?', 'Sight', 'Smell', 'Taste', 'Touch'],
      ['How many letters are in the English alphabet?', '26', '24', '28', '25']
    ]
  }
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function topics() {
  return Object.keys(BANK);
}

function pickSet(topic) {
  const t = String(topic || '').toLowerCase().trim();
  if (!t) return BANK.general;
  if (BANK[t]) return BANK[t];
  let best = null;
  let bestScore = 0;
  Object.keys(BANK).forEach(name => {
    const set = BANK[name];
    let score = 0;
    set.keys.concat([name]).forEach(k => {
      if (t.includes(k) || k.includes(t)) score = Math.max(score, k.length);
    });
    if (score > bestScore) { bestScore = score; best = set; }
  });
  return best;
}

/* returns [{ text, answers[4], correct, time }] with the correct answer
   shuffled into a random slot each time */
function generate(topic, count) {
  const set = pickSet(topic);
  if (!set) return [];
  return shuffle(set.q).slice(0, count).map(row => {
    const text = row[0];
    const right = row[1];
    const options = shuffle([row[1], row[2], row[3], row[4]]);
    return {
      text,
      answers: options,
      correct: options.indexOf(right),
      time: 20,
      image: ''
    };
  });
}

module.exports = { generate, topics };
