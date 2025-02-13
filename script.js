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
    // Show the loading indicator for form blocks
    
    // Get the form section containers
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

        // Fetch data concurrently
        const [formConfig, drivers, constructors, players] = await Promise.all([
            fetchFormConfiguration(),
            fetchData('drivers', 'id, name, constructor_id'),
            fetchData('constructors', 'id, name'),
            fetchData('players', 'id, name'),
        ]);

        // Map constructor IDs to names for quick lookup
        const constructorMap = Object.fromEntries(constructors.map(c => [c.id, c.name]));

        // Prepare a sorted list of constructors by id order for the team dropdown
        const sortedConstructors = [...constructors].sort((a, b) => a.id - b.id);

        // Loop through each form configuration
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
                    // Sort drivers by id order
                    const sortedDrivers = [...drivers]
                        .sort((a, b) => a.id - b.id)
                        .map(d => ({
                            id: d.id,
                            name: `${d.name} (${constructorMap[d.constructor_id] || 'Unknown'})`,
                        }));
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver');
                    break;
                }
                case 'Select - Driver List + DNF': {
                    // Sort drivers by id order and then append the no-DNF option at the end
                    const sortedDrivers = [...drivers]
                        .sort((a, b) => a.id - b.id)
                        .map(d => ({
                            id: d.id,
                            name: `${d.name} (${constructorMap[d.constructor_id] || 'Unknown'})`,
                        }));
                    sortedDrivers.push({ id: 'no-dnf', name: 'No DNFs' });
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver or no DNFs');
                    break;
                }
                case 'Select - Team List': {
                    // Use the sorted team list (by id order)
                    createDropdown(block, sortedConstructors, `input-${config.id}`, 'Select a team');
                    break;
                }
                case 'Select - Name List': {
                    // Retrieve the logged-in player's ID from cookies.
                    const loggedInPlayerId = getCookie("playerId");
                    let displayText = "Please log in";
                    let hiddenValue = "";
                  
                    if (loggedInPlayerId) {
                        // Find the player's name using the ID.
                        const matchingPlayer = players.find(p => String(p.id) === String(loggedInPlayerId));
                        if (matchingPlayer) {
                            displayText = matchingPlayer.name;
                            hiddenValue = loggedInPlayerId;
                        }
                    }
                  
                    // Create a visible, readonly input for display.
                    const visibleInput = document.createElement('input');
                    visibleInput.type = 'text';
                    visibleInput.value = displayText;
                    visibleInput.id = `input-${config.id}-visible`;
                    visibleInput.className = 'form-control autofilled-player-name';
                    visibleInput.readOnly = true;
                    visibleInput.disabled = true; // Makes it look disabled
                  
                    // Create a hidden input to store the actual player ID for form submission.
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.name = `input-${config.id}`;
                    hiddenInput.id = `input-${config.id}`;
                    hiddenInput.value = hiddenValue;
                  
                    // Append both elements to the form block.
                    block.appendChild(visibleInput);
                    block.appendChild(hiddenInput);
                  
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

            // Add the form-control class to any inputs or selects
            const inputs = block.querySelectorAll('input, select');
            inputs.forEach(input => {
            if (input.type !== 'radio') {
                input.classList.add('form-control');
            }
            });

            // Assign blocks to the correct form sections based on config id
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
    } finally {
        // Hide the loading indicator once the function has completed processing
        const loadingIndicator = document.getElementById('formLoading');
        loadingIndicator.style.display = 'none';
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

// script.js (ES Module)

// --- COOKIE HELPERS ---
export function getCookie(name) {
    const cookieArr = document.cookie.split(";");
    for (let cookie of cookieArr) {
      let [key, value] = cookie.split("=");
      if (key.trim() === name) {
        return value;
      }
    }
    return null;
  }
  
  export function setCookie(name, value, maxAgeInSeconds) {
    let cookieString = `${name}=${value}; path=/;`;
    if (maxAgeInSeconds) {
      cookieString += ` max-age=${maxAgeInSeconds};`;
    }
    document.cookie = cookieString;
  }
  
  export function clearCookie(name) {
    document.cookie = `${name}=; path=/; max-age=0;`;
  }
  
  // --- LOGIN SYSTEM FUNCTIONS ---
  export async function populateLoginPlayerDropdown() {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, password')
      .order('name');
  
    if (error) {
      console.error('Error fetching players:', error);
      return;
    }
  
    document.getElementById('login-player-name').innerHTML =
      `<option value="" disabled selected>Select a name</option>` +
      players.map(player => `<option value="${player.id}">${player.name}</option>`).join('');
  }
  
  export function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.classList.add('pixel-alert', `pixel-alert-${type}`);
    alert.innerHTML = message;
    alertContainer.appendChild(alert);
  
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 3000);
  }
  
  // --- Color Helpers ---
  // Returns a color from a fixed palette based on the letter (or a default color)
  export function getColorForLetter(letter) {
    const colors = [
      '#FF5733', // 0
      '#33FF57', // 1
      '#3357FF', // 2
      '#F333FF', // 3
      '#33FFF3', // 4
      '#FF33F3', // 5
      '#F3FF33', // 6
      '#FF8C33', // 7
      '#33FF8C', // 8
      '#8C33FF'  // 9
    ];
  
    let index;
    if (letter >= 'A' && letter <= 'Z') {
      index = (letter.charCodeAt(0) - 65) % colors.length;
    } else {
      index = colors.length - 1;
    }
    return colors[index];
  }
  
  // Darkens a hex color by a given percentage (0-100)
  export function darkenColor(hex, percent) {
    // Remove '#' if present
    hex = hex.replace(/^#/, '');
    // Convert 3-digit hex to 6-digit hex if needed
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    // Decrease each channel by the percentage
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));
    
    // Convert back to hex, padding with zeros if needed
    r = r.toString(16).padStart(2, '0');
    g = g.toString(16).padStart(2, '0');
    b = b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  // --- Avatar & UI ---
  // Updates the user avatar using the accent color and styles it similar to the heading
  export function updateUserAvatar(playerName) {
    const userAvatar = document.getElementById('user-avatar');
    if (!userAvatar) return;
  
    const firstLetter = playerName.charAt(0).toUpperCase();
    const bgColor = getColorForLetter(firstLetter);
    // Darken the chosen background color by 20% for the text shadow effect
    const shadowColor = darkenColor(bgColor, 50);
  
    userAvatar.textContent = firstLetter;
    userAvatar.style.backgroundColor = bgColor;
    userAvatar.style.color = "#fff";
    // Use two-layer text shadow similar to your heading (scaled down for the small avatar)
    userAvatar.style.textShadow = `1px 1px 0 ${shadowColor}, 2px 2px 0 ${shadowColor}`;
    // Ensure the font styling matches your heading style:
    userAvatar.style.fontFamily = "'Press Start 2P', Helvetica, sans-serif";
    userAvatar.style.fontWeight = "bold";
    userAvatar.style.textAlign = "center";
    userAvatar.style.lineHeight = userAvatar.style.height; // vertically center text
    userAvatar.classList.remove('d-none');
  }
  
  export function hideUserAvatar() {
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
      userAvatar.classList.add('d-none');
      userAvatar.textContent = '';
      userAvatar.style.backgroundColor = '';
      userAvatar.style.textShadow = '';
    }
  }
  
  export function updateLoginUI(playerData) {
    const playerName = playerData.name;
  
    // Hide the "Log In" menu item.
    const loginMenuItem = document.getElementById('loginMenuItem');
    if (loginMenuItem) {
      loginMenuItem.classList.add('d-none');
    }
  
    // Show "Logged in as ..." text.
    const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');
    if (loggedInUserDisplay) {
      loggedInUserDisplay.innerHTML = `Logged in as <strong>${playerName}</strong>`;
      loggedInUserDisplay.classList.remove('d-none');
    }
  
    // Show the "Log Out" link and attach its event listener.
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    if (logoutMenuItem) {
      logoutMenuItem.classList.remove('d-none');
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        // Use "onclick" to ensure only one event handler is attached.
        logoutBtn.onclick = () => {
          if (confirm('Are you sure you want to log out?')) {
            clearCookie("playerId");
            loggedInUserDisplay.classList.add('d-none');
            logoutMenuItem.classList.add('d-none');
            if (loginMenuItem) {
              loginMenuItem.classList.remove('d-none');
            }
            hideUserAvatar();
            updateFormPlayerDisplay(null);
            document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: false } }));
            showAlert('You have logged out!', 'success');
          }
        };
      }
    }
  
    // Update the header avatar.
    updateUserAvatar(playerName);
  
    // Close the login modal and shift focus to the hamburger menu (to avoid ARIA issues).
    const loginModalEl = document.getElementById('loginModal');
    let modalInstance = bootstrap.Modal.getInstance(loginModalEl);
    if (!modalInstance) {
      modalInstance = new bootstrap.Modal(loginModalEl);
    }
    modalInstance.hide();
    setTimeout(() => {
      document.getElementById('hamburgerMenu').focus();
    }, 300);
  }
  
  
  // --- INITIALIZATION ---
  document.addEventListener("DOMContentLoaded", async () => {
    await populateLoginPlayerDropdown();
  
    // Auto-login: Check for an existing cookie.
    const playerIdCookie = getCookie("playerId");
    if (playerIdCookie) {
      const { data: playerData, error } = await supabase
        .from('players')
        .select('id, name, password')
        .eq('id', playerIdCookie)
        .single();
      if (!error && playerData) {
        updateLoginUI(playerData);
      }
    }
  
    // Login form submission handler.
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
  
        const playerId = document.getElementById('login-player-name').value;
        const pin = document.getElementById('login-pin').value;
        const rememberMe = document.getElementById('rememberMe').checked;
  
        if (pin.length !== 4) {
          alert('Please enter a 4-digit PIN.');
          return;
        }
  
        const { data: playerData, error } = await supabase
          .from('players')
          .select('id, name, password')
          .eq('id', playerId)
          .single();
  
        if (error || !playerData) {
          alert('Error logging in. Please try again.');
          return;
        }
  
        const hashedPin = CryptoJS.MD5(pin).toString();
  
        if (hashedPin === playerData.password) {
            showAlert('Login successful!', 'success');
        
            // Set cookie, update login UI, etc.
            if (rememberMe) {
                setCookie("playerId", playerId, 30 * 24 * 60 * 60); // 30 day cookie
            } else {
                setCookie("playerId", playerId);
            }
        
            // Update the login UI in the menu, avatar, etc.
            updateLoginUI(playerData);
            document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: true } }));
            // Update the auto-filled player display in the form.
            updateFormPlayerDisplay(playerData.name);
        } else {
            showAlert('Incorrect PIN. Please try again.', 'danger');
        }
        
      });
    }
  });

  export function updateFormPlayerDisplay(newPlayerName) {
    // Look for all elements that should display the player's name.
    const displayElems = document.querySelectorAll('.autofilled-player-name');
    displayElems.forEach(elem => {
      if (newPlayerName) {
        if (elem.tagName.toLowerCase() === 'input') {
          elem.value = newPlayerName;
        } else {
          elem.textContent = newPlayerName;
        }
      } else {
        if (elem.tagName.toLowerCase() === 'input') {
          elem.value = "Please log in";
        } else {
          elem.textContent = "Please log in";
        }
      }
    });
  }
  

  