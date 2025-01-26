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
        return data || [];
    } catch (err) {
        console.error(`Unexpected error fetching ${table}:`, err);
        return [];
    }
}

// Helper function to create a dropdown
// Helper function to create a dropdown
function createDropdown(parent, options = [], inputId, defaultText = 'Select an option') {
    const select = document.createElement('select');
    select.id = inputId;
    select.name = inputId;
    select.className = 'form-select'; // Bootstrap styling for dropdowns

    // Add a default "Select ..." option
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; // No value for the default option
    defaultOption.textContent = defaultText;
    defaultOption.disabled = true; // Disable selection
    defaultOption.selected = true; // Make it selected by default
    select.appendChild(defaultOption);

    // Ensure options is an array
    if (!Array.isArray(options)) {
        console.error('Invalid options passed to createDropdown:', options);
        return;
    }

    // Add the rest of the options
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.id; // Use 'id' as value
        opt.textContent = option.name; // Use 'name' for display
        select.appendChild(opt);
    });

    parent.appendChild(select); // Add the dropdown to the parent container
}


// Dropdown with custom option (e.g., "No DNFs")
export async function createDriverDropdownWithDNF(container, id) {
    const drivers = await fetchData('drivers', 'id, name');
    const options = [
        ...drivers.map(driver => ({ id: driver.id, name: driver.name })),
        { id: 'no-dnf', name: 'No DNFs' }, // Add the custom option
    ];
    createDropdown(container, options, id);
}

// Number input field
export function createNumberInput(container, id, isDecimal) {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.name = id;
    input.step = isDecimal ? '0.01' : '1';
    input.placeholder = isDecimal ? 'Enter a number (2 decimal places)' : 'Enter a number (0-20)';
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
        input.className = 'form-check-input'; // Bootstrap class for proper styling

        const label = document.createElement('label');
        label.htmlFor = `${id}-${value.toLowerCase()}`;
        label.textContent = value;
        label.className = 'form-check-label'; // Bootstrap class for labels

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Heads/Tails input field
export function createHeadsTailsInput(container, id) {
    ['Heads', 'Tails'].forEach(value => {
        const div = document.createElement('div');
        div.className = 'form-check'; // Bootstrap styling for radio buttons

        const input = document.createElement('input');
        input.type = 'radio';
        input.id = `${id}-${value.toLowerCase()}`;
        input.name = id;
        input.value = value.toLowerCase();
        input.className = 'form-check-input'; // Bootstrap class for proper styling

        const label = document.createElement('label');
        label.htmlFor = `${id}-${value.toLowerCase()}`;
        label.textContent = value;
        label.className = 'form-check-label'; // Bootstrap class for labels

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Generate form blocks dynamically
export async function generateFormBlocks() {
    // Get the loading indicator and form sections
    const formContainer1 = document.getElementById('form-section-1');
    const formContainer2 = document.getElementById('form-section-2');
    const formContainer3 = document.getElementById('form-section-3');
    const formContainer4 = document.getElementById('form-section-4');

    try {
        // Clear any existing content
        formContainer1.innerHTML = '';
        formContainer2.innerHTML = '';
        formContainer3.innerHTML = '';
        formContainer4.innerHTML = '';

        // Fetch data
        const [formConfig, drivers, constructors, players] = await Promise.all([
            fetchFormConfiguration(),
            fetchData('drivers', 'id, name, constructor_id'),
            fetchData('constructors', 'id, name'),
            fetchData('players', 'id, name'),
        ]);

        // Map constructor IDs to names for quick lookup
        const constructorMap = Object.fromEntries(constructors.map(c => [c.id, c.name]));

        // Loop through form configurations
        for (const config of formConfig) {
            const block = document.createElement('div');
            block.className = 'mb-3';

            const label = document.createElement('label');
            label.textContent = config.text;
            label.className = 'form-label';

            // Append additional text for specific scoring types
            if (config.scoring_type === 'Plus Minus One (2)') {
                const smallText = document.createElement('small');
                smallText.textContent = ' (2 points for correct, 1 point for +/- 1)';
                smallText.style.fontSize = 'smaller';
                label.appendChild(smallText);
            } else if (config.scoring_type === 'Driver + Team (2)') {
                const smallText = document.createElement('small');
                smallText.textContent = ' (2 points for correct driver, 1 point for correct team)';
                smallText.style.fontSize = 'smaller';
                label.appendChild(smallText);
            }

            block.appendChild(label);

            // Determine input type based on response_type
            switch (config.response_type) {
                case 'Select - Driver List': {
                    const sortedDrivers = drivers.map(d => ({
                        id: d.id,
                        name: `${d.name} (${constructorMap[d.constructor_id] || 'Unknown'})`,
                    }));
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver');
                    break;
                }
                case 'Select - Driver List + DNF': {
                    const sortedDrivers = drivers.map(d => ({
                        id: d.id,
                        name: `${d.name} (${constructorMap[d.constructor_id] || 'Unknown'})`,
                    }));
                    sortedDrivers.push({ id: 'no-dnf', name: 'No DNFs' });
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver or no DNFs');
                    break;
                }
                case 'Select - Team List': {
                    createDropdown(block, constructors, `input-${config.id}`, 'Select a team');
                    break;
                }
                case 'Select - Name List': {
                    const sortedPlayers = players.sort((a, b) => a.name.localeCompare(b.name));
                    createDropdown(block, sortedPlayers, `input-${config.id}`, 'Select a name');
                    break;
                }
                case 'Number - Integer':
                    createNumberInput(block, `input-${config.id}`, false);
                    break;
                case 'Number - Decimal':
                    createNumberInput(block, `input-${config.id}`, true);
                    break;
                case 'Radio - Yes/No':
                    createYesNoInput(block, `input-${config.id}`);
                    break;
                case 'Radio - Heads/Tails':
                    createHeadsTailsInput(block, `input-${config.id}`);
                    break;
                default:
                    console.error('Unknown response type:', config.response_type);
            }

            const inputs = block.querySelectorAll('input, select');
            inputs.forEach(input => input.classList.add('form-control'));

            // Assign blocks to the correct form sections
            if (config.id === 1) {
                formContainer1.appendChild(block);
            } else if (config.id >= 2 && config.id <= 7) {
                formContainer2.appendChild(block);
            } else if (config.id >= 8 && config.id <= 27) {
                formContainer3.appendChild(block);
            } else if (config.id === 28) {
                formContainer4.appendChild(block);
            }
        }
    } catch (error) {
        console.error('Error generating form blocks:', error);
    }
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


