'use strict';
/* MOKI Spark - a completely offline question generator.
   No external service, no API key, no cost. It matches the host's typed
   topic against a built-in bank using loose keyword matching, then shuffles
   both the question order and the answer positions. If nothing matches it
   returns an empty list and the creator falls back to manual entry. */

const BANK = {
  nineties: {
    keys: ['90s', 'nineties', '1990s'],
    q: [
      ['Which decade did the Nintendo 64 launch in?', 'The 1990s', 'The 1980s', 'The 2000s', 'The 1970s'],
      ['What hit boy band formed in 1995 included Justin Timberlake?', '*NSYNC', 'Backstreet Boys', 'Westlife', 'Take That'],
      ['Which 1997 film about a sinking ship became the highest-grossing movie of its time?', 'Titanic', 'Armageddon', 'The Matrix', 'Jurassic Park'],
      ['What was the top-selling toy fad of 1996 involving a virtual pet?', 'Tamagotchi', 'Beanie Babies', 'Furby', 'Pokemon cards'],
      ['Which search engine, now a verb, launched in 1998?', 'Google', 'Yahoo', 'AltaVista', 'Bing'],
      ['Friends, the hit sitcom, premiered in which year?', '1994', '1990', '1998', '2000'],
      ['Which console war rival to the PlayStation launched in 1994 in Japan?', 'Sega Saturn', 'Xbox', 'GameCube', 'Dreamcast'],
      ['What email service, launched in 1996, popularised free webmail?', 'Hotmail', 'Gmail', 'Yahoo Mail', 'Outlook']
    ]
  },
  y2k: {
    keys: ['2000s', 'noughties', 'y2k'],
    q: [
      ['Which social network, launched in 2004, started as a Harvard-only site?', 'Facebook', 'MySpace', 'Twitter', 'Friendster'],
      ['What iPhone generation launched in 2007 started the smartphone boom?', 'The original iPhone', 'iPhone 3G', 'iPhone 4', 'iPhone 5'],
      ['Which video-sharing site launched in 2005?', 'YouTube', 'Vimeo', 'TikTok', 'Twitch'],
      ['What 2008 film introduced Iron Man and began a shared superhero universe?', 'Iron Man', 'The Dark Knight', 'Spider-Man', 'X-Men'],
      ['Which dance-based rhythm game franchise exploded in popularity in the mid-2000s?', 'Guitar Hero', 'Dance Dance Revolution', 'Rock Band', 'Just Dance'],
      ['What microblogging platform launched in 2006?', 'Twitter', 'Tumblr', 'Instagram', 'Reddit'],
      ['Which reality show, starting in 2002, had contestants voted off an island?', 'Survivor', 'Big Brother', 'The Bachelor', 'American Idol'],
      ['What 2009 film became the highest-grossing film of all time at release?', 'Avatar', 'Avengers', 'Titanic', 'Star Wars']
    ]
  },
  lightning: {
    keys: ['lightning', 'speed round', 'true or false', 'true false', 'quickfire'],
    q: [
      ['True or False: The Great Wall of China is visible from space with the naked eye.', 'False', 'True', 'False', 'True'],
      ['True or False: Bananas grow on trees.', 'False', 'True', 'False', 'True'],
      ['True or False: A group of crows is called a murder.', 'True', 'False', 'True', 'False'],
      ['True or False: Goldfish have a memory span of only three seconds.', 'False', 'True', 'False', 'True'],
      ['True or False: The Eiffel Tower can be taller in summer than in winter due to heat expansion.', 'True', 'False', 'True', 'False'],
      ['True or False: Humans only use 10 percent of their brains.', 'False', 'True', 'False', 'True'],
      ['True or False: Sharks are mammals.', 'False', 'True', 'False', 'True'],
      ['True or False: Lightning never strikes the same place twice.', 'False', 'True', 'False', 'True'],
      ['True or False: Mount Everest is the tallest mountain measured from base to peak.', 'False', 'True', 'False', 'True'],
      ['True or False: Honey never spoils if stored properly.', 'True', 'False', 'True', 'False']
    ]
  },
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
    keys: ['sport', 'sports', 'football', 'cricket', 'olympic', 'game day', 'athletics', 'ipl', 'world cup'],
    q: [
      ['How many players are on a football (soccer) team on the pitch?', 'Eleven', 'Nine', 'Ten', 'Twelve'],
      ['How often are the Summer Olympic Games normally held?', 'Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years'],
      ['In cricket, how many runs is a ball hit over the boundary without bouncing?', 'Six', 'Four', 'Five', 'Three'],
      ['Which sport uses a shuttlecock?', 'Badminton', 'Tennis', 'Squash', 'Table tennis'],
      ['How many points is a standard basketball field goal inside the arc?', 'Two', 'One', 'Three', 'Four'],
      ['In tennis, what is a score of zero called?', 'Love', 'Nil', 'Duck', 'Blank'],
      ['How many holes are played in a full round of golf?', 'Eighteen', 'Nine', 'Twelve', 'Twenty'],
      ['Which country hosted the first modern Olympic Games?', 'Greece', 'France', 'Italy', 'England'],
      ['Which country has won the most FIFA World Cup titles?', 'Brazil', 'Germany', 'Italy', 'Argentina'],
      ['Which cricketer is nicknamed the "God of Cricket" and holds the record for most international centuries?', 'Sachin Tendulkar', 'Virat Kohli', 'Ricky Ponting', 'Brian Lara'],
      ['The IPL (Indian Premier League) is a professional league for which sport?', 'Cricket', 'Football', 'Hockey', 'Badminton'],
      ['Which athlete holds the world record for the men s 100m sprint?', 'Usain Bolt', 'Carl Lewis', 'Tyson Gay', 'Justin Gatlin']
    ]
  },
  technology: {
    keys: ['tech', 'technology', 'computer', 'internet', 'software', 'ai', 'hardware', 'gadget'],
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
  coding: {
    keys: ['coding', 'programming', 'code', 'developer', 'python', 'javascript', 'software engineer'],
    q: [
      ['Which language is famous for using indentation instead of curly braces?', 'Python', 'Java', 'C++', 'Ruby'],
      ['What does HTML stand for?', 'HyperText Markup Language', 'HighText Machine Language', 'HyperTransfer Markup Language', 'HyperText Modern Language'],
      ['Which company originally created JavaScript?', 'Netscape', 'Microsoft', 'Google', 'Apple'],
      ['What symbol starts a single-line comment in Python?', '#', '//', '--', '<!--'],
      ['Which language runs natively inside web browsers?', 'JavaScript', 'Python', 'C', 'Swift'],
      ['What does SQL stand for?', 'Structured Query Language', 'Simple Query Logic', 'Sequential Query Language', 'Structured Question Language'],
      ['In programming, what do we call a reusable named block of code?', 'A function', 'A variable', 'A loop', 'A class'],
      ['Which data structure follows a First In, First Out order?', 'A queue', 'A stack', 'A tree', 'A graph']
    ]
  },
  flags: {
    keys: ['flag', 'flags', 'national flag', 'country flag'],
    q: [
      ['How many stars are on the flag of the United States?', '50', '48', '52', '13'],
      ['Which country s flag features a red maple leaf?', 'Canada', 'USA', 'Norway', 'Austria'],
      ['What colours are on the flag of Germany, top to bottom?', 'Black, red, gold', 'Red, gold, black', 'Gold, black, red', 'Red, black, gold'],
      ['The Union Jack is the national flag of which country?', 'The United Kingdom', 'Ireland', 'Australia', 'New Zealand'],
      ['Which country s flag has a large red circle on a white background?', 'Japan', 'South Korea', 'Bangladesh', 'Palau'],
      ['How many colours are on the flag of India?', 'Three', 'Two', 'Four', 'Five'],
      ['Which shape is unusual about Nepal s national flag compared to most countries?', 'It is not rectangular', 'It has no colour', 'It is circular', 'It has no symbol'],
      ['Which country s flag is a plain red field with a white maple leaf?', 'Canada', 'Switzerland', 'Austria', 'Peru']
    ]
  },
  food: {
    keys: ['food', 'cuisine', 'cooking', 'recipe', 'dish', 'eating'],
    q: [
      ['What is the main ingredient in guacamole?', 'Avocado', 'Tomato', 'Onion', 'Lime'],
      ['Sushi originated in which country?', 'Japan', 'China', 'Thailand', 'Korea'],
      ['What type of dough is used to make a croissant?', 'Puff pastry', 'Bread dough', 'Pizza dough', 'Pie crust'],
      ['Which fruit is nicknamed the king of fruits in Southeast Asia?', 'Durian', 'Mango', 'Jackfruit', 'Lychee'],
      ['What is the main ingredient in hummus?', 'Chickpeas', 'Lentils', 'Black beans', 'Peanuts'],
      ['Pizza as we know it today originated in which country?', 'Italy', 'Greece', 'France', 'Spain'],
      ['Which spice, the most expensive by weight, comes from the crocus flower?', 'Saffron', 'Cinnamon', 'Vanilla', 'Cardamom'],
      ['Tofu is made primarily from which bean?', 'Soybeans', 'Kidney beans', 'Chickpeas', 'Black beans'],
      ['Takoyaki, a popular Japanese street snack, is a ball-shaped dish filled with what?', 'Octopus', 'Shrimp', 'Chicken', 'Pork'],
      ['Pad Thai, a famous street food dish, originates from which country?', 'Thailand', 'Vietnam', 'Indonesia', 'Malaysia'],
      ['Churros, a fried-dough snack, are most associated with which region?', 'Spain and Latin America', 'France', 'Italy', 'Germany'],
      ['Which dessert is made of thin pastry layers filled with honey and chopped nuts?', 'Baklava', 'Tiramisu', 'Macaron', 'Cannoli']
    ]
  },
  mythology: {
    keys: ['mythology', 'myth', 'myths', 'greek god', 'norse', 'legend', 'legendary'],
    q: [
      ['In Greek mythology, who is the king of the gods?', 'Zeus', 'Poseidon', 'Hades', 'Apollo'],
      ['Which Norse god is associated with thunder?', 'Thor', 'Odin', 'Loki', 'Baldr'],
      ['What creature has a human torso and the body of a horse?', 'A centaur', 'A minotaur', 'A satyr', 'A griffin'],
      ['In Greek myth, who flew too close to the sun with wax wings?', 'Icarus', 'Perseus', 'Theseus', 'Achilles'],
      ['Who is the Greek goddess of wisdom?', 'Athena', 'Aphrodite', 'Hera', 'Artemis'],
      ['What is the name of the three-headed dog guarding the Greek underworld?', 'Cerberus', 'Cyclops', 'Hydra', 'Chimera'],
      ['Which Egyptian god has the head of a jackal?', 'Anubis', 'Ra', 'Horus', 'Osiris'],
      ['In Norse mythology, what is the name of the great world tree?', 'Yggdrasil', 'Asgard', 'Valhalla', 'Bifrost']
    ]
  },
  inventions: {
    keys: ['invention', 'inventions', 'inventor', 'invented', 'discovery'],
    q: [
      ['Who is credited with inventing the telephone?', 'Alexander Graham Bell', 'Thomas Edison', 'Nikola Tesla', 'Guglielmo Marconi'],
      ['Who invented the first commercially practical light bulb?', 'Thomas Edison', 'Benjamin Franklin', 'Nikola Tesla', 'James Watt'],
      ['What did the Wright brothers invent?', 'The airplane', 'The automobile', 'The telegraph', 'The steam engine'],
      ['Who is credited with inventing the World Wide Web?', 'Tim Berners-Lee', 'Bill Gates', 'Steve Jobs', 'Alan Turing'],
      ['Which ancient invention revolutionised transport and is linked to Mesopotamia?', 'The wheel', 'The sail', 'The plough', 'The compass'],
      ['Who invented the printing press with movable type?', 'Johannes Gutenberg', 'William Caxton', 'Leonardo da Vinci', 'Isaac Newton'],
      ['What did Alexander Fleming accidentally discover that transformed medicine?', 'Penicillin', 'Vaccination', 'X-rays', 'Aspirin'],
      ['Who is known for building the first practical electric battery?', 'Alessandro Volta', 'Michael Faraday', 'Thomas Edison', 'Benjamin Franklin']
    ]
  },
  art: {
    keys: ['art', 'artist', 'painting', 'paintings', 'sculpture', 'museum'],
    q: [
      ['Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'],
      ['Which artist famously cut off part of his own ear?', 'Vincent van Gogh', 'Claude Monet', 'Pablo Picasso', 'Edgar Degas'],
      ['Who painted the ceiling of the Sistine Chapel?', 'Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Botticelli'],
      ['Which art movement is Pablo Picasso most associated with?', 'Cubism', 'Impressionism', 'Surrealism', 'Baroque'],
      ['Salvador Dali s melting clocks are a famous example of which art movement?', 'Surrealism', 'Cubism', 'Realism', 'Pop art'],
      ['Which Paris museum houses the Mona Lisa?', 'The Louvre', 'Musee d Orsay', 'Centre Pompidou', 'Petit Palais'],
      ['Who sculpted the statue of David?', 'Michelangelo', 'Bernini', 'Donatello', 'Rodin'],
      ['Which artist is famous for soup can paintings and the pop art movement?', 'Andy Warhol', 'Jackson Pollock', 'Roy Lichtenstein', 'Keith Haring']
    ]
  },
  beforeafter: {
    keys: ['before', 'after', 'which happened first', 'timeline', 'order of events', 'history quiz'],
    q: [
      ['Which of these happened first?', 'The Wright brothers first powered flight', 'The first iPhone release', 'The Moon landing', 'The invention of the World Wide Web'],
      ['Which of these happened first?', 'The fall of the Berlin Wall', 'The release of the first PlayStation', 'The first Harry Potter book', 'The founding of Facebook'],
      ['Which of these happened first?', 'The invention of the telephone', 'The sinking of the Titanic', 'The end of World War II', 'The first Moon landing'],
      ['Which of these came out first?', 'The original Star Wars film (Episode IV)', 'The first Toy Story film', 'The first Harry Potter film', 'The first Iron Man film'],
      ['Which of these happened first?', 'YouTube was founded', 'The first iPhone was released', 'Instagram was founded', 'TikTok launched globally'],
      ['Which of these happened first?', 'The modern Olympic Games began', 'The Wright brothers first flight', 'The first football World Cup', 'The invention of television'],
      ['Which of these happened first?', 'The American Declaration of Independence', 'The French Revolution', 'World War I', 'The Russian Revolution'],
      ['Which of these happened first?', 'The Berlin Wall was built', 'The first man landed on the Moon', 'The Chernobyl disaster', 'The Soviet Union dissolved']
    ]
  },
  blurimage: {
    keys: ['blur', 'blurry', 'guess the image', 'picture round', 'visual round'],
    q: [
      ['This blurred picture is from which topic?', 'Science', 'Space', 'History', 'Food', '/icons/topics/science.jpg'],
      ['This blurred picture is from which topic?', 'Space', 'Science', 'Animals', 'Music', '/icons/topics/space.jpg'],
      ['This blurred picture is from which topic?', 'History', 'Mythology', 'Geography', 'Art', '/icons/topics/history.jpg'],
      ['This blurred picture is from which topic?', 'Geography', 'History', 'Flags', 'Sports', '/icons/topics/geography.jpg'],
      ['This blurred picture is from which topic?', 'Animals', 'Food', 'Sports', 'Space', '/icons/topics/animals.jpg'],
      ['This blurred picture is from which topic?', 'Sports', 'Gaming', 'Animals', 'Brands', '/icons/topics/sports.jpg'],
      ['This blurred picture is from which topic?', 'Coding', 'Technology', 'Maths', 'Inventions', '/icons/topics/coding.jpg'],
      ['This blurred picture is from which topic?', 'Flags', 'Geography', 'Brands', 'History', '/icons/topics/flags.jpg'],
      ['This blurred picture is from which topic?', 'Food', 'Animals', 'Art', 'Science', '/icons/topics/food.jpg'],
      ['This blurred picture is from which topic?', 'Mythology', 'History', 'Anime', 'Movies', '/icons/topics/mythology.jpg'],
      ['This blurred picture is from which topic?', 'Inventions', 'Coding', 'Technology', 'Art', '/icons/topics/inventions.jpg'],
      ['This blurred picture is from which topic?', 'Art', 'Mythology', 'Brands', 'Food', '/icons/topics/art.jpg'],
      ['This blurred picture is from which topic?', 'Movies', 'Anime', 'Music', 'Gaming', '/icons/topics/movies.jpg'],
      ['This blurred picture is from which topic?', 'Music', 'Movies', 'Anime', 'Myths', '/icons/topics/music.jpg'],
      ['This blurred picture is from which topic?', 'Gaming', 'Technology', 'Coding', 'Movies', '/icons/topics/gaming.jpg'],
      ['This blurred picture is from which topic?', 'Brands', 'Food', 'Flags', 'Art', '/icons/topics/brands.jpg']
    ]
  },
  brands: {
    keys: ['brand', 'brands', 'slogan', 'slogans', 'logo', 'logos', 'advertising', 'company'],
    q: [
      ['Which company uses the slogan "Just Do It"?', 'Nike', 'Adidas', 'Puma', 'Reebok'],
      ['Which brand s logo is a bitten apple?', 'Apple', 'Samsung', 'Microsoft', 'Google'],
      ['Which fast food chain uses the slogan "I m Lovin It"?', 'McDonald s', 'Burger King', 'KFC', 'Subway'],
      ['Which company s slogan is "Think Different"?', 'Apple', 'IBM', 'Dell', 'Sony'],
      ['Which car brand uses a four-ring logo?', 'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen'],
      ['Which company s logo is a swoosh tick?', 'Nike', 'Adidas', 'Under Armour', 'New Balance'],
      ['Which brand s slogan is "Because You re Worth It"?', 'L Oreal', 'Maybelline', 'Revlon', 'Dove'],
      ['Which coffee brand s logo is a green twin-tailed mermaid?', 'Starbucks', 'Costa Coffee', 'Dunkin', 'Tim Hortons']
    ]
  },
  anime: {
    keys: ['anime', 'manga', 'otaku', 'japanese animation', 'naruto', 'one piece'],
    q: [
      ['In Naruto, what is the name of the nine-tailed fox sealed inside the main character?', 'Kurama', 'Shukaku', 'Gyuki', 'Matatabi'],
      ['Which anime features a notebook that can kill anyone whose name is written in it?', 'Death Note', 'Naruto', 'Bleach', 'One Piece'],
      ['What is the name of the main character in One Piece who searches for the title treasure?', 'Monkey D. Luffy', 'Roronoa Zoro', 'Sanji', 'Usopp'],
      ['In Attack on Titan, what do the giant humanoid Titans threaten humanity with?', 'Extinction beyond the walls', 'A space invasion', 'A zombie plague', 'An ice age'],
      ['Which studio is famous for Spirited Away and My Neighbor Totoro?', 'Studio Ghibli', 'Toei Animation', 'Madhouse', 'Sunrise'],
      ['In Dragon Ball, what is the name of the main character?', 'Goku', 'Vegeta', 'Piccolo', 'Gohan'],
      ['What are the special eye powers of the Uchiha clan called in Naruto?', 'Sharingan', 'Byakugan', 'Rinnegan', 'Mangekyo'],
      ['Which anime follows students training to become professional heroes at U.A. High?', 'My Hero Academia', 'Naruto', 'Bleach', 'Demon Slayer']
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
      image: row[5] || ''
    };
  });
}

module.exports = { generate, topics };
