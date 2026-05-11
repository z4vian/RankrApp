Rankr
A cross-platform iOS app that lets users build ranked lists of music, movies, and video games through head-to-head comparisons. Instead of manually ordering a list, Rankr surfaces two items at a time and asks a simple question: which do you prefer? A binary comparison algorithm processes those choices and produces a ranked list scored 1–10.

How It Works

Search for any album, film, or game using the in-app search
Add items to a collection (music, movies, or games — each tracked separately)
Rankr presents head-to-head matchups between items in the collection
After enough comparisons, the algorithm assigns each item a numeric score from 1–10
The final ranked list updates in real time as new comparisons are made


AI-Assisted Development
This project was built with heavy use of AI tools throughout the development process:

Architecture planning — Used Claude and ChatGPT to design the overall component structure, data flow, and state management approach before writing any code
UI scaffolding — AI-generated initial layouts for core screens, which were then refined and customized
Algorithm design — Worked with Claude to design and validate the binary comparison scoring logic
Debugging — Used AI tools iteratively to diagnose and resolve issues across API integration and state management

This workflow reflects a deliberate practice of AI-accelerated development: using LLMs to compress the architecture and planning phase, then building and refining from a stronger starting point.

Tech Stack

Framework: Expo (React Native)
Language: JavaScript
APIs:

Last.fm — music search and metadata
RAWG — video game database
MDB — movie metadata




Project Structure
app/           # Screen components and navigation
components/    # Reusable UI components
hooks/         # Custom React hooks
constants/     # Shared config and theme values
assets/        # Fonts and images

Running Locally
Requires Node.js and the Expo Go app on a physical device or simulator.
bashgit clone https://github.com/z4vian/Rankr
cd Rankr
npm install
npx expo start
Scan the QR code with Expo Go (iOS) or run on a simulator via the terminal menu.

The full app source including navigation is also available at github.com/z4vian/RankrApp


Screenshots
Coming soon
