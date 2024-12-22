// Initialize Supabase client
const supabaseUrl = 'https://mbyhlefxnjjzmiwsvnaa.supabase.co'
const supabaseKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ieWhsZWZ4bmpqem1pd3N2bmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzODQwOTgsImV4cCI6MjA0OTk2MDA5OH0.4gcUcOfhyTspbcDn6gPxBKFSTu3zUbkBdNEhMq9MdnY
const supabase = createClient(supabaseUrl, supabaseKey)

// Function to populate dropdowns
async function populateDropdown(tableName, dropdownId, columnName) {
    try {
        // Fetch data from the specified table
        const { data, error } = await supabase.from(tableName).select(columnName);

        if (error) throw error;

        const dropdown = document.getElementById(dropdownId);
        dropdown.innerHTML = ''; // Clear existing options

        // Add a default blank option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an option';
        dropdown.appendChild(defaultOption);

        // Populate the dropdown with data
        data.forEach((row) => {
            const option = document.createElement('option');
            option.value = row[columnName];
            option.textContent = row[columnName];
            dropdown.appendChild(option);
        });
    } catch (err) {
        console.error(`Error loading data for ${dropdownId}:`, err.message);
    }
}

// Function to set up the form
async function setupFormPage() {
    await populateDropdown('participants', 'nameDropdown', 'name');
    await populateDropdown('drivers', 'winningDriverDropdown', 'name');
    await populateDropdown('teams', 'winningTeamDropdown', 'name');
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('nameDropdown').value;
    const winningDriver = document.getElementById('winningDriverDropdown').value;
    const winningTeam = document.getElementById('winningTeamDropdown').value;
    const winningMargin = document.getElementById('winningMargin').value;

    if (!name || !winningDriver || !winningTeam || !winningMargin) {
        alert('Please fill in all fields!');
        return;
    }

    // Display entered values in console (replace this with your desired logic)
    console.log('Form Submitted:', { name, winningDriver, winningTeam, winningMargin });

    // Example of storing the results in a "results" table
    try {
        const { error } = await supabase.from('results').insert([
            { participant: name, driver: winningDriver, team: winningTeam, margin: parseFloat(winningMargin) }
        ]);

        if (error) throw error;

        alert('Form submitted successfully!');
    } catch (err) {
        console.error('Error saving form data:', err.message);
        alert('There was an error submitting the form. Please try again.');
    }
}

// Initialize page logic when DOM is ready
document.addEventListener('DOMContentLoaded', setupFormPage);
document.getElementById('form').addEventListener('submit', handleSubmit);

// Initialize Supabase
const supabase = supabase.createClient('https://your-project-url.supabase.co', 'public-anon-key');

// Tab switching logic
document.querySelectorAll('.nav-link').forEach((tab) => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.nav-link.active').classList.remove('active');
        tab.classList.add('active');
        document.querySelector('.tab-pane.active').classList.remove('active');
        document.querySelector(tab.getAttribute('href')).classList.add('active');
    });
});

// Register Player
document.getElementById('register-player-btn').addEventListener('click', async () => {
    const playerName = document.getElementById('player-name').value.trim();
    if (playerName) {
        const { data, error } = await supabase.from('participants').insert([{ name: playerName }]);
        if (!error) {
            loadPlayers();
        }
    }
});

// Register Team
document.getElementById('register-team-btn').addEventListener('click', async () => {
    const teamName = document.getElementById('team-name').value.trim();
    if (teamName) {
        const { data, error } = await supabase.from('participant_teams').insert([{ name: teamName }]);
        if (!error) {
            loadTeams();
        }
    }
});

// Join Team
document.getElementById('join-team-btn').addEventListener('click', async () => {
    const playerName = document.getElementById('join-player-name').value.trim();
    const teamId = document.getElementById('team-select').value;
    if (playerName && teamId) {
        const { data, error } = await supabase.from('participants').insert([{ name: playerName, participant_team_id: teamId }]);
        if (!error) {
            loadTeamsWithPlayers();
        }
    }
});

// Load Players
async function loadPlayers() {
    const { data, error } = await supabase.from('participants').select('*');
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    data.forEach((player) => {
        const li = document.createElement('li');
        li.textContent = player.name;
        li.classList.add('list-group-item');
        list.appendChild(li);
    });
}

// Load Teams
async function loadTeams() {
    const { data, error } = await supabase.from('participant_teams').select('*');
    const list = document.getElementById('team-list');
    const select = document.getElementById('team-select');
    list.innerHTML = '';
    select.innerHTML = '';
    data.forEach((team) => {
        const li = document.createElement('li');
        li.textContent = team.name;
        li.classList.add('list-group-item');
        list.appendChild(li);
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        select.appendChild(option);
    });
}

// Load Teams with Players
async function loadTeamsWithPlayers() {
    const { data, error } = await supabase
        .from('participant_teams')
        .select('id, name, participants (name)');
    const list = document.getElementById('teams-with-players');
    list.innerHTML = '';
    data.forEach((team) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${team.name}</strong><ul>${team.participants.map((p) => `<li>${p.name}</li>`).join('')}</ul>`;
        li.classList.add('list-group-item');
        list.appendChild(li);
    });
}

// Initial load
loadPlayers();
loadTeams();
loadTeamsWithPlayers();