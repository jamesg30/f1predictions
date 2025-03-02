// General and Form Code
// ensure buttons work
document.addEventListener("touchstart", function() {}, false);

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
  // Add a custom class so we can target it with our CSS if needed.
  select.className = 'form-select custom-dropdown';

  // Add a default "Select ..." option.
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = defaultText;
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  // Ensure options is an array.
  if (!Array.isArray(options)) {
    console.error('Invalid options passed to createDropdown:', options);
    return;
  }

  // Create each option and attach extra colour data if available.
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.id; // Use 'id' as value.
    opt.textContent = option.name; // Display text.
    if (option.bgColor) {
      opt.dataset.bgcolor = option.bgColor;
    }
    if (option.textColor) {
      opt.dataset.textcolor = option.textColor;
    }
    select.appendChild(opt);
  });

  // Listen for changes and update the dropdown's inline style.
  select.addEventListener('change', function () {
    const selectedOption = select.options[select.selectedIndex];
    const bgColor = selectedOption.dataset.bgcolor;
    const textColor = selectedOption.dataset.textcolor;
    // console.log(
    //  `Dropdown [${inputId}] changed. Selected: "${selectedOption.textContent}". Detected bgColor: ${bgColor}, textColor: ${textColor}`
    //);
    if (bgColor && textColor) {
      select.style.setProperty('background-color', bgColor, 'important');
      select.style.setProperty('color', textColor, 'important');
    } else {
      select.style.removeProperty('background-color');
      select.style.removeProperty('color');
    }
  });

  parent.appendChild(select);

  // If a non-default option is already selected (for instance, via pre-fill), force a change event.
  if (select.selectedIndex > 0) {
    select.dispatchEvent(new Event('change'));
  }

  return select;
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
// Number input field
export function createNumberInput(container, id, isDecimal) {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.name = id;
  input.step = isDecimal ? '0.01' : '1';
  input.min = '0';
  input.max = isDecimal ? '1000' : '20';
  input.placeholder = isDecimal 
    ? 'Enter a number (up to 2 decimal places)' 
    : 'Enter a number (0-20)';
  
  // Limit input to 7 characters (note: enforcement may vary for numeric inputs)
  input.setAttribute('maxlength', '7');

  if (isDecimal) {
    // Enforce no more than 2 decimal places.
    input.addEventListener('input', function() {
      const value = input.value;
      if (value.includes('.')) {
        const parts = value.split('.');
        if (parts[1].length > 2) {
          input.value = parts[0] + '.' + parts[1].substring(0, 2);
        }
      }
    });
  } else {
    // Enforce only integers: if a decimal point is entered, remove it and all following characters.
    input.addEventListener('input', function() {
      const value = input.value;
      if (value.includes('.')) {
        const parts = value.split('.');
        input.value = parts[0];
      }
    });
  }

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
            fetchData('constructors', 'id, name, background_colour, text_colour'),
            fetchData('players', 'id, name'),
        ]);
        
        // Map constructor IDs to names for quick lookup
        const constructorMap = Object.fromEntries(constructors.map(c => [c.id, c]));

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
                const sortedDrivers = [...drivers]
                    .sort((a, b) => a.id - b.id)
                    .map(d => ({
                        id: d.id,
                        name: `${d.name} (${constructorMap[d.constructor_id]?.name || 'Unknown'})`,
                        bgColor: constructorMap[d.constructor_id]?.background_colour || '',
                        textColor: constructorMap[d.constructor_id]?.text_colour || ''
                    }));
                createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver');
                break;
            }
            case 'Select - Driver List + DNF': {
                const sortedDrivers = [...drivers]
                    .sort((a, b) => a.id - b.id)
                    .map(d => ({
                        id: d.id,
                        name: `${d.name} (${constructorMap[d.constructor_id]?.name || 'Unknown'})`,
                        bgColor: constructorMap[d.constructor_id]?.background_colour || '',
                        textColor: constructorMap[d.constructor_id]?.text_colour || ''
                    }));
                sortedDrivers.push({ id: 'no-dnf', name: 'No DNFs', bgColor: '', textColor: '' });
                createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver or no DNFs');
                break;
            }
            case 'Select - Team List': {
                const teamOptions = sortedConstructors.map(c => ({
                    id: c.id,
                    name: c.name,
                    bgColor: c.background_colour,
                    textColor: c.text_colour
                }));
                createDropdown(block, teamOptions, `input-${config.id}`, 'Select a team');
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
  
    // Populate the datalist for player names
    const dataList = document.getElementById('players-list');
    if (dataList) {
      dataList.innerHTML = players
        .map(player => `<option data-id="${player.id}" value="${player.name}"></option>`)
        .join('');
    }
  }
  
  
  export function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.classList.add('alert', `alert-${type}`);
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
      '#fb9605', // 0 - orange
      '#fc3d11', // 1 - red
      '#A7FC00', // 2 - bright green
      '#20e1d1', // 3 - aqua
      '#9c1ae7', // 4 - purple
      '#0B6623', // 5 - forest green
      '#f5ed16', // 6 - yellow
      '#178bd5', // 7 - dark blue
      '#fb5cab', // 8 - light pink
      '#52c1fa'  // 9 - light blue
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

  // --- Avatar Rendering ---
// Renders an avatar icon into a given element using the provided settings.
// The 'letter' parameter should be the player's actual first letter.
export function renderAvatar(element, settings, letter = 'A') {
  // Determine if this is the small header icon vs. a larger preview.
  const isSmall = element.classList.contains('user-avatar');
  // Use different padding based on the size.
  const padVal = isSmall ? "0.2rem" : "0.2rem";
  
  let shadow;
  let innerContent = "";

  if (settings.type === 'letter') {
    // Use the default logic for letter avatars from updateUserAvatar:
    const displayLetter = settings.letter ? settings.letter.toUpperCase() : letter;
    // Use the backgroundColor from settings if available, otherwise calculate it.
    const bgColor = settings.backgroundColor || getColorForLetter(displayLetter);
    const shadowColor = darkenColor(settings.iconColor, 50);
    
    // Directly apply the default styling
    element.textContent = displayLetter;
    element.style.backgroundColor = bgColor;
    element.style.color = settings.iconColor;
    element.style.textShadow = `1px 1px 0 ${shadowColor}, 2px 2px 0 ${shadowColor}`;
    element.style.fontFamily = "'Montserrat', Helvetica, sans-serif";
    element.style.fontWeight = "bold";
    element.style.textAlign = "center";
    // Set lineHeight to the element's height (ensure the height is defined via CSS)
    element.style.lineHeight = element.style.height;
    
    // Exit early so that the default content isn’t overwritten.
    return;
  } else if (settings.type === 'monochrome') {
    // Monochrome icons: use inverted asset and apply a shadow offset.
    const newIcon = `icon_invert_${settings.icon}`;
    shadow = darkenColor(settings.iconColor, 60);
    let offset = isSmall
      ? ((settings.icon === 'icon_monster.png' || settings.icon === 'icon_redbull.png' || settings.icon === 'icon_fish.png' || settings.icon === 'icon_tram.png') ? 0 : 0) // prev 0.5 : 1
      : ((settings.icon === 'icon_monster.png' || settings.icon === 'icon_redbull.png' || settings.icon === 'icon_fish.png' || settings.icon === 'icon_tram.png') ? 0 : 0); // prev 1 : 2
      
    innerContent = `<div style="padding: ${padVal}; width: 100%; height: 100%; box-sizing: border-box;">
      <div style="position: relative; width: 100%; height: 100%;">
        <!-- Shadow layer -->
        <div style="
          position: absolute;
          top: ${offset}px;
          left: ${offset}px;
          width: 100%;
          height: 100%;
          background-color: ${shadow};
          -webkit-mask-image: url('/media/icons/${newIcon}');
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-image: url('/media/icons/${newIcon}');
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
        "></div>
        <!-- Icon layer -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: ${settings.iconColor};
          -webkit-mask-image: url('/media/icons/${newIcon}');
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-image: url('/media/icons/${newIcon}');
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
        "></div>
      </div>
    </div>`;
    element.style.textShadow = 'none';

  } else {
    // For fixed icons (e.g. tyre icons and the new Red Bull coloured icon)
    // For the red bull coloured icon, we render it as a normal image (no mask) and use a smaller shadow offset.
    let fixedShadowOffset = (settings.icon === 'icon_redbullcolour')
      ? (isSmall ? "0px" : "0px") // 0.5 : 1
      : (isSmall ? "0px" : "0px"); // 1 : 2
    shadow = '#000000';
    // Ensure that if the icon value doesn’t already include an extension, add .png.
    const iconSrc = settings.icon.includes('.png') ? settings.icon : settings.icon + '.png';
    let imgContent = `<img src="/media/icons/${iconSrc}" alt="Avatar Icon" style="
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(${fixedShadowOffset} ${fixedShadowOffset} 0px ${shadow});
    ">`;
    innerContent = `<div style="padding: ${padVal}; width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
      ${imgContent}
    </div>`;
    element.style.textShadow = 'none';
  }

  element.innerHTML = innerContent;
  element.style.backgroundColor = settings.backgroundColor;
}

  // --- Avatar & UI ---
  // Updates the user avatar using the accent color and styles it similar to the heading
  export function updateUserAvatar(playerData) {
    const userAvatar = document.getElementById('user-avatar');
    if (!userAvatar) return;
    
    const letter = playerData.name.charAt(0).toUpperCase();
    
    if (playerData.avatar_settings) {
      // Use the custom avatar settings (pass the player's letter)
      renderAvatar(userAvatar, playerData.avatar_settings, letter);
    } else {
      // Fallback: render a default letter avatar.
      const bgColor = getColorForLetter(letter);
      const shadowColor = darkenColor(bgColor, 50);
      
      userAvatar.textContent = letter;
      userAvatar.style.backgroundColor = bgColor;
      userAvatar.style.color = "#fff";
      userAvatar.style.textShadow = `1px 1px 0 ${shadowColor}, 2px 2px 0 ${shadowColor}`;
      userAvatar.style.fontFamily = "'Montserrat', Helvetica, sans-serif";
      userAvatar.style.fontWeight = "bold";
      userAvatar.style.textAlign = "center";
      userAvatar.style.lineHeight = userAvatar.style.height;
    }
    
    userAvatar.classList.remove('d-none');
    
    // Special styling for playerId "1"
    if (getCookie("playerId") === "1") {
      userAvatar.style.borderColor = "gold";
    } else if (getCookie("playerId") === "12") {
      userAvatar.style.borderColor = "red";
    } else if (getCookie("playerId") === "45") {
      userAvatar.style.borderColor = "#9210B7";
    } else {
      userAvatar.style.borderColor = "#c0c0c0";
    }
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
  
  // --- Update UI Logout Handler ---
// Within your updateLoginUI (or wherever you handle logout) add the reset.
export function updateLoginUI(playerData) {
  const playerName = playerData.name;
  
  // Hide the Log In button.
  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.classList.add('d-none');
  }
  
  // Show the avatar dropdown container.
  const avatarDropdownContainer = document.getElementById('avatarDropdownContainer');
  if (avatarDropdownContainer) {
    avatarDropdownContainer.classList.remove('d-none');
  }
  
  // Show "Logged in as ..." text in the dropdown.
  const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');
  if (loggedInUserDisplay) {
    loggedInUserDisplay.innerHTML = `Logged in as <strong>${playerName}</strong>`;
    loggedInUserDisplay.classList.remove('d-none');
  }
  
  // Show the "Log Out" link.
  const logoutMenuItem = document.getElementById('logoutMenuItem');
  if (logoutMenuItem) {
    logoutMenuItem.classList.remove('d-none');
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        const confirmed = await showCustomConfirm('Are you sure you want to log out?');
        if (!confirmed) {
          return; // User canceled the action
        }

        // Proceed with logout
        clearCookie("playerId");
        localStorage.removeItem("darkMode"); // Clear dark mode preference from local storage.
        setDarkMode(false); // Force light mode.
        loggedInUserDisplay.classList.add('d-none');
        logoutMenuItem.classList.add('d-none');
        if (loginButton) {
          loginButton.classList.remove('d-none');
        }
        hideUserAvatar();
        updateFormPlayerDisplay(null);
        document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: false } }));
        showAlert('You have logged out!', 'success');
        resetLoginForm();
      };
    }
  }

  
  // Update the header avatar using the entire player data.
  updateUserAvatar(playerData);
  
  // --- ADMIN LINK HANDLING ---
  // Only add an Admin link in the dropdown if the logged-in user has id === 1.
  if (playerData.id === 1 || getCookie("playerId") === "1") {
    const dropdownMenu = document.getElementById('userDropdown').nextElementSibling;
    let adminLinkItem = document.getElementById('adminLinkItem');
    if (!adminLinkItem && dropdownMenu) {
      adminLinkItem = document.createElement('li');
      adminLinkItem.id = 'adminLinkItem';
      adminLinkItem.innerHTML = `<a class="dropdown-item body-text-xs" href="/admin">Admin</a>`;
      dropdownMenu.appendChild(adminLinkItem);
    }
  } else {
    const adminLinkItem = document.getElementById('adminLinkItem');
    if (adminLinkItem) {
      adminLinkItem.remove();
    }
  }
  
  // Close the login modal and shift focus.
  const loginModalEl = document.getElementById('loginModal');
  let modalInstance = bootstrap.Modal.getInstance(loginModalEl);
  if (!modalInstance) {
    modalInstance = new bootstrap.Modal(loginModalEl);
  }
  modalInstance.hide();
  setTimeout(() => {
    document.getElementById('userDropdown').focus();
  }, 300);
}

  // --- Helper: Reset Login Form ---
// Clears the login form and resets its fields to default state.
function resetLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  // Clear all form fields.
  loginForm.reset();

  // Ensure fields are enabled.
  const playerNameInput = document.getElementById('login-player-name');
  const pinInput = document.getElementById('login-pin');
  const loginButton = loginForm.querySelector('button[type="submit"]');
  playerNameInput.disabled = false;
  pinInput.disabled = false;
  // Disable the login button until both fields have values.
  loginButton.disabled = true;
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  await populateLoginPlayerDropdown();

  const playerIdCookie = getCookie("playerId");
  const userAvatar = document.getElementById('user-avatar');
  const avatarDropdownContainer = document.getElementById('avatarDropdownContainer');
  const loginButton = document.getElementById('loginButton');

  if (playerIdCookie) {
    // Cookie is present: leave the grey box in place.
    if (userAvatar) {
      userAvatar.textContent = ""; // ensure placeholder is blank
      userAvatar.style.backgroundColor = "#ccc"; // light grey placeholder
    }
  } else {
    // No cookie: hide the avatar placeholder and show the login button.
    if (avatarDropdownContainer) avatarDropdownContainer.classList.add('d-none');
    if (loginButton) loginButton.classList.remove('d-none');
  }

  // Auto-login: If a cookie exists, fetch and render the actual avatar.
  if (playerIdCookie) {
    const { data: playerData, error } = await supabase
      .from('players')
      .select('id, name, password, avatar_settings')
      .eq('id', playerIdCookie)
      .single();
    if (!error && playerData) {
      updateLoginUI(playerData);
    }
  }
  
  // Get references to the login form elements.
// Note: We rename the login form’s submit button to avoid conflict with the header login button.
const loginForm = document.getElementById('login-form');
const playerNameInput = document.getElementById('login-player-name');
const pinInput = document.getElementById('login-pin');
const loginSubmitButton = loginForm.querySelector('button[type="submit"]');

function toggleLoginButton() {
  if (playerNameInput.value.trim() !== "" && pinInput.value.trim() !== "") {
    loginSubmitButton.disabled = false;
  } else {
    loginSubmitButton.disabled = true;
  }
}


  playerNameInput.addEventListener('input', toggleLoginButton);
  pinInput.addEventListener('input', toggleLoginButton);

  // Ensure the login button is disabled initially.
  loginSubmitButton.disabled = true;

  // Login form submission handler.
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      // Immediately disable the button and both input fields to prevent duplicate submissions.
      loginSubmitButton.disabled = true;
      playerNameInput.disabled = true;
      pinInput.disabled = true;
  
      const playerName = playerNameInput.value;
      const pin = pinInput.value;
      const rememberMe = document.getElementById('rememberMe').checked;
  
      if (pin.length !== 4) {
        showAlert('Please enter a 4-digit PIN.', 'danger');
        // Re-enable inputs so the user can correct it.
        loginSubmitButton.disabled = false;
        playerNameInput.disabled = false;
        pinInput.disabled = false;
        return;
      }
  
      // Query player by name (assuming names are unique) and include dark_mode
      const { data: playerData, error } = await supabase
        .from('players')
        .select('id, name, password, avatar_settings, dark_mode')
        .eq('name', playerName)
        .single();
  
      if (error || !playerData) {
        showAlert('Error logging in. Please try again.', 'danger');
        loginSubmitButton.disabled = false;
        playerNameInput.disabled = false;
        pinInput.disabled = false;
        return;
      }
  
      const hashedPin = CryptoJS.MD5(pin).toString();
  
      if (hashedPin === playerData.password) {
        showAlert('Login successful!', 'success');
        // Set cookie and update login UI.
        if (rememberMe) {
          setCookie("playerId", playerData.id, 30 * 24 * 60 * 60); // 30-day cookie
        } else {
          setCookie("playerId", playerData.id);
        }
        // Check player's dark mode preference and apply the theme.
        if (playerData.dark_mode) {
          setDarkMode(true);
        } else {
          setDarkMode(false);
        }
        updateLoginUI(playerData);
        document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: true } }));
        updateFormPlayerDisplay(playerData.name);
      } else {
        showAlert('Incorrect PIN. Please try again.', 'danger');
        // Clear the PIN field on incorrect PIN.
        pinInput.value = "";
        // Re-enable the inputs so the user can try again.
        playerNameInput.disabled = false;
        pinInput.disabled = false;
        toggleLoginButton();
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

  export function showCustomAlert(message) {
    const modalEl = document.getElementById('customAlertModal');
    modalEl.querySelector('.modal-body').textContent = message;
    const alertModal = new bootstrap.Modal(modalEl);
    alertModal.show();
  }
  

  export function showCustomConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('customConfirmModal');
      // Update the title and message in the modal
      document.getElementById('customConfirmModalLabel').textContent = title;
      modalEl.querySelector('.modal-body').textContent = message;
      
      // Get the OK and Cancel buttons
      const btnOk = document.getElementById('customConfirmOk');
      const btnCancel = document.getElementById('customConfirmCancel');
      
      // Create a new Bootstrap modal instance
      const confirmModal = new bootstrap.Modal(modalEl);
      
      // Clear any existing click handlers to avoid duplicate events
      btnOk.replaceWith(btnOk.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
      
      // Re-select the cloned buttons
      const newBtnOk = document.getElementById('customConfirmOk');
      const newBtnCancel = document.getElementById('customConfirmCancel');
      
      // Set up event listeners for the buttons
      newBtnOk.addEventListener('click', () => {
        resolve(true);
        confirmModal.hide();
      });
      
      newBtnCancel.addEventListener('click', () => {
        resolve(false);
        confirmModal.hide();
      });
      
      // Also handle dismissal by clicking the close button or outside the modal
      modalEl.addEventListener('hidden.bs.modal', function handler() {
        // Remove this handler after it fires to avoid duplicate resolution
        modalEl.removeEventListener('hidden.bs.modal', handler);
        // If neither button was clicked, resolve as false.
        // (This may occur if the user clicks outside the modal or uses the close button.)
        resolve(false);
      });
      
      // Finally, show the modal
      confirmModal.show();
    });
  }
  
// ================= //
// === DARK MODE === //
// ================= //

// Helper to update dark mode and reload the page
function setDarkMode(enable) {
  localStorage.setItem('darkMode', enable);

  // Update the stylesheet dynamically without reloading
  const link = document.getElementById('themeStylesheet');
  if (link) {
    link.href = enable ? '/dark.css' : '/light.css';
  }
  
  // Dispatch a custom event to notify that the theme has changed
  window.dispatchEvent(new Event('themeChanged'));
}


// Fetch user preferences from the players table (using the player's ID from a cookie)
async function loadUserPreferences() {
  const playerId = getCookie("playerId");
  if (!playerId) return;

  // Retrieve the dark_mode setting
  const { data, error } = await supabase
    .from('players')
    .select('dark_mode')
    .eq('id', playerId)
    .single();

  if (error || !data) {
    console.error("Error fetching user preferences", error);
    return;
  }

  const darkModeEnabled = data.dark_mode === true;
  localStorage.setItem('darkMode', darkModeEnabled);
  console.log('loadUserPreferences: Dark mode saved in localStorage as', darkModeEnabled);

  // Set the toggle state
  const darkToggle = document.getElementById("darkModeToggle");
  if (darkToggle) darkToggle.checked = darkModeEnabled;
}

// Update the player's dark_mode setting in the players table
async function updateDarkModePreference(enable) {
  const playerId = getCookie("playerId");
  if (!playerId) return;

  const { error } = await supabase
    .from('players')
    .update({ dark_mode: enable })
    .eq('id', playerId);

  if (error) {
    console.error("Error updating dark mode preference", error);
  } else {
    console.log('updateDarkModePreference: Preference updated to', enable);
  }
}

// Set up the event listener on the dark mode toggle switch
document.addEventListener("DOMContentLoaded", () => {
  // Only load preferences if the user is logged in
  if (getCookie("playerId")) {
    loadUserPreferences();
  }

  const darkToggle = document.getElementById("darkModeToggle");
  if (darkToggle) {
    darkToggle.addEventListener("change", async function () {
      const enable = darkToggle.checked;
      await updateDarkModePreference(enable);
      console.log('Dark mode toggle changed. Reloading page...');
      setDarkMode(enable); // This updates localStorage and reloads the page
    });
  }
});

export function createSmallAvatarHTML(player) {
  // Use the player's name to get the first letter (fallback to "?" if missing)
  const letter = player.name ? player.name.charAt(0).toUpperCase() : '?';
  const avatar = document.createElement('div');
  avatar.classList.add('small-avatar');
  
  // Use inline-block layout (ensures one line) with centered text.
  avatar.style.display = "inline-block";
  avatar.style.width = "1.8rem";
  avatar.style.height = "1.8rem";
  avatar.style.fontSize = "1rem";
  avatar.style.lineHeight = "1.8rem"; // Vertically center text
  avatar.style.textAlign = "center";
  avatar.style.marginRight = "0.5rem";
  // avatar.style.border = "1px solid #c0c0c0";
  if (player.name === 'James') {
    avatar.style.border = "1px solid gold";
  } else if (player.name === 'Josh Watling') {
    avatar.style.border = "1px solid red";
  } else if (player.name === 'Damien') {
    avatar.style.border = "1px solid #9210B7";
  } else {
    avatar.style.border = "1px solid #c0c0c0";
  }
  avatar.style.borderRadius = "50%";
  
  // If custom avatar settings exist, render that; otherwise, fallback to a letter avatar.
  if (player.avatar_settings) {
    renderAvatar(avatar, player.avatar_settings, letter);
    // Force inline-block again in case renderAvatar changes it:
    avatar.style.display = "inline-block";
    avatar.style.lineHeight = "1.8rem";
    avatar.style.textAlign = "center";
  } else {
    avatar.textContent = letter;
    const bgColor = getColorForLetter(letter);
    avatar.style.backgroundColor = bgColor;
    avatar.style.color = "#fff";
    avatar.style.fontFamily = 'Montserrat';
    avatar.style.fontWeight = 700;
    // Add a small text shadow using a darkened version of the background.
    const shadowColor = darkenColor(bgColor, 30);
    avatar.style.textShadow = `1px 1px 0 ${shadowColor}`;
  }
  
  return avatar.outerHTML;
}

