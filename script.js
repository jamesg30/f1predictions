// Initialize Supabase client
const supabaseUrl = 'https://mbyhlefxnjjzmiwsvnaa.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
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
