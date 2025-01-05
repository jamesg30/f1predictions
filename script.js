// General and Form Code
// 1. Fetch Form Configuration
export async function fetchFormConfiguration() {
    try {
        const { data, error } = await supabase
            .from('form_configuration')
            .select('*')
            .order('id', { ascending: true }); // Ensure sorted order by id

        if (error) {
            console.error('Error fetching form configuration:', error);
            return [];
        }

        // Filter out disabled questions
        return data.filter(config => config.enabled !== false);
    } catch (err) {
        console.error('Unexpected error:', err);
        return [];
    }
}

// 2. General Purpose Fetch Functions
export async function fetchData(table, fields = '*') {
    try {
        const { data, error } = await supabase.from(table).select(fields);
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return [];
        }
        return data;
    } catch (err) {
        console.error(`Unexpected error fetching ${table}:`, err);
        return [];
    }
}

// 3. Create Dropdowns
export async function createDropdown(container, id, table, defaultText) {
    const data = await fetchData(table, 'id, name');
    const select = document.createElement('select');
    select.id = id;
    select.name = id;
    select.className = 'form-select'; // Bootstrap styling for dropdowns

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultText;
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });

    container.appendChild(select);
}

export async function createDriverDropdown(container, id) {
    await createDropdown(container, id, 'drivers', 'Select a driver');
}

export async function createConstructorDropdown(container, id) {
    await createDropdown(container, id, 'constructors', 'Select a constructor');
}

export async function createPlayerDropdown(container, id) {
    await createDropdown(container, id, 'players', 'Select a name');
}

export async function createTeamDropdown(container, id) {
    await createDropdown(container, id, 'teams', 'Select a team');
}

// Dropdown with custom option (e.g., "No DNFs")
export async function createDriverDropdownWithDNF(container, id) {
    const drivers = await fetchData('drivers', 'id, name');
    const select = document.createElement('select');
    select.id = id;
    select.name = id;
    select.className = 'form-select'; // Bootstrap styling for dropdowns

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a driver or No DNFs';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    drivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = driver.name;
        select.appendChild(option);
    });

    const noDnfOption = document.createElement('option');
    noDnfOption.value = 'no-dnf';
    noDnfOption.textContent = 'No DNFs';
    select.appendChild(noDnfOption);

    container.appendChild(select);
}

// Number input field
export function createNumberInput(container, id, isDecimal) {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.name = id;
    input.step = isDecimal ? '0.01' : '1';
    input.placeholder = isDecimal ? 'Enter a decimal value' : 'Enter an integer';
    container.appendChild(input);
}

// Yes/No input field
export function createYesNoInput(container, id) {
    ['Yes', 'No'].forEach(value => {
        const div = document.createElement('div');
        div.className = 'form-check'; // Bootstrap styling for radio buttons

        const input = document.createElement('input');
        input.type = 'radio';
        input.id = `${id}-${value.toLowerCase()}`;
        input.name = id;
        input.value = value.toLowerCase();
        input.className = 'form-check-input'; // Bootstrap styling

        const label = document.createElement('label');
        label.htmlFor = `${id}-${value.toLowerCase()}`;
        label.textContent = value;
        label.className = 'form-check-label'; // Bootstrap styling for labels

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

export async function generateFormBlocks() {
    const formConfig = await fetchFormConfiguration();

    // Define the containers for each group
    const group1Container = document.getElementById('group-1-container');
    const group2Container = document.getElementById('group-2-container');
    const group3Container = document.getElementById('group-3-container');
    const group4Container = document.getElementById('group-4-container');

    // Clear the containers to avoid duplication
    group1Container.innerHTML = '';
    group2Container.innerHTML = '';
    group3Container.innerHTML = '';
    group4Container.innerHTML = '';

    // Define group boundaries
    const group1 = formConfig.filter(config => config.id === 1);
    const group2 = formConfig.filter(config => config.id >= 2 && config.id <= 7);
    const group3 = formConfig.filter(config => config.id >= 8 && config.id <= 27);
    const group4 = formConfig.filter(config => config.id === 28);

    // Function to generate a group of questions
    async function generateGroup(configGroup, container) {
        for (const config of configGroup) {
            const block = document.createElement('div');
            block.className = 'mb-3'; // Add Bootstrap margin class for spacing

            const label = document.createElement('label');
            label.textContent = config.text;
            label.className = 'form-label'; // Bootstrap styling for labels
            block.appendChild(label);

            switch (config.response_type) {
                case 'Select - Driver List':
                    await createDriverDropdown(block, `input-${config.id}`);
                    break;
                case 'Select - Driver List + DNF':
                    await createDriverDropdownWithDNF(block, `input-${config.id}`);
                    break;
                case 'Select - Team List':
                    await createConstructorDropdown(block, `input-${config.id}`);
                    break;
                case 'Select - Name List':
                    await createPlayerDropdown(block, `input-${config.id}`);
                    break;
                case 'Number - Integer':
                    createNumberInput(block, `input-${config.id}`, false);
                    break;
                case 'Number - Decimal':
                    createNumberInput(block, `input-${config.id}`, true);
                    break;
                case 'Radio - Yes/No':
                    createYesNoInput(block, `input-${config.id}`);
                    break;
                default:
                    console.error('Unknown response type:', config.response_type);
            }

            // Add form-control class to all inputs and selects
            const inputs = block.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.classList.add('form-control');
            });

            container.appendChild(block);
        }
    }

    // Generate groups into respective containers
    await generateGroup(group1, group1Container);
    await generateGroup(group2, group2Container);
    await generateGroup(group3, group3Container);
    await generateGroup(group4, group4Container);
}



// Register Page Functions
export async function fetchAndDisplayList(table, containerId) {
    const data = await fetchData(table, 'name');
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    data.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = item.name;
        listItem.className = 'list-group-item';
        container.appendChild(listItem);
    });
}

export async function registerPlayer() {
    const playerName = document.getElementById('player-name').value.trim();
    if (!playerName) {
        alert('Please enter a valid name.');
        return;
    }

    try {
        const { error } = await supabase.from('players').insert([{ name: playerName }]);
        if (error) throw error;
        alert('Player registered successfully!');
        document.getElementById('player-name').value = '';
        await fetchAndDisplayList('players', 'player-list');
    } catch (err) {
        console.error('Error registering player:', err);
        alert('Failed to register player.');
    }
}

export async function registerTeam() {
    const teamName = document.getElementById('team-name').value.trim();
    if (!teamName) {
        alert('Please enter a valid team name.');
        return;
    }

    try {
        const { error } = await supabase.from('teams').insert([{ name: teamName }]);
        if (error) throw error;
        alert('Team registered successfully!');
        document.getElementById('team-name').value = '';
        await fetchAndDisplayList('teams', 'team-list');
    } catch (err) {
        console.error('Error registering team:', err);
        alert('Failed to register team.');
    }
}