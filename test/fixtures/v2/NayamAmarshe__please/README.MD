<div align="center">

**For updates, questions and more:**    

<a href="https://t.me/iamnayam">
<img src="https://user-images.githubusercontent.com/25067102/209297095-a3db856f-b760-40bb-a68e-f3a3086e18c7.png" width="300px" />
</a>
</div>

<h1 align="center">🙏 Please - New Tab Page for your Terminal 🙏</h1>

<h4 align="center">Get a beautifully formatted minimalistic new tab page with a greeting, date and time, inspirational quotes, your personal tasks and to-do list everytime you open the terminal with Please CLI.</h4>

<p align="center"><img src="https://user-images.githubusercontent.com/25067102/173348894-09190c99-baff-477a-9b48-b4d3cff0f029.gif"></img></center>

# [Version 0.3.1 is out now!](https://github.com/NayamAmarshe/please/releases/tag/0.3.1)
### Upgrade with `pip3 install please-cli --upgrade`

# 📖 Table of Contents

- [🚀 Installation](#-installation)
   - [1️⃣ Method 1](#method-1)
   - [2️⃣ Method 2](#method-2)
- [🚑 Troubleshooting](#-troubleshooting)
- [👨‍💻 Commands](#-commands)
- [🧰 Additional Optional Configuration](#-additional-optional-configuration)
- [🚮 Uninstalling](#-uninstalling)
- [❤ Credits](#-credits)

# 🚀 Installation

### Method 1:

1. Make sure you have Python 3 installed on your computer.
2. Open your terminal and paste the command below:

   ```bash
   pip install please-cli

   # If you get an error about 'pip not found', just replace pip with pip3.
   ```

3. To run **please** everytime you open the terminal:

   ```bash
   # FOR BASH
   echo 'please' >> ~/.bashrc

   # FOR ZSH
   echo 'please' >> ~/.zshrc
   
   # FOR FISH
   set fish_greeting please
   ```

   Or if you prefer to run **please** once a day:

   ```bash
   # FOR BASH
   echo 'please daily' >> ~/.bashrc

   # FOR ZSH
   echo 'please daily' >> ~/.zshrc
   
   # FOR FISH
   set fish_greeting please daily
   ```

4. That's it! Check if `please` command works in your terminal.

### Method 2:

1. Go to the releases section.
2. Download the latest release WHL file.
3. Open terminal and paste the command below:

   ```bash
   pip install --user ~/Downloads/please_cli*

   # If you get an error about 'pip not found', just replace pip with pip3.
   ```

   Change the path of the file if you downloaded it elsewhere.

4. To run **please** everytime you open the terminal:

   ```bash
   # FOR BASH
   echo 'please' >> ~/.bashrc

   # FOR ZSH
   echo 'please' >> ~/.zshrc
   
   # FOR FISH
   set fish_greeting please
   ```

5. That's it! Check if `please` command works in your terminal.

###### Having trouble with installation or have any ideas? Please create an issue ticket :)

# 🚑 Troubleshooting

Getting a `command not found: please` error? That means the Python modules installation folder is not in PATH.
To fix this:

```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
```
and restart the terminal.

# 👨‍💻 Commands

Some of these commands may not be in the latest release.
```bash
# Show time, quotes and tasks
please

# Add a task
please add "TASK NAME"

# Delete a task
please delete <TASK NUMBER>

# Mark task as done
please do <TASK NUMBER>

# Edit task name
please edit <TASK NUMBER> <NEW NAME>

# Mark task as undone
please undo <TASK NUMBER>

# Show tasks even if all tasks are marked as done
please showtasks

# Move task to specified position
please move <OLD NUMBER> <NEW NUMBER>

# Toggle Time between 24 hours and 12 hours format
please changetimeformat

# Change your name
please callme "NAME"

# Delete all done tasks
please clean

# Reset all settings and tasks
please setup
```

# 🧰 Additional Optional Configuration

![image](https://user-images.githubusercontent.com/25067102/184050404-15c787d5-4b2f-40c5-a2df-0b2892099f1a.png)

## Remove Greeting in please's output

1.Navigate to `~/.config/please`  
2. Open config.json  
3. Change `"diable_greeting": false` to `"diable_greeting": true` (All lowercase).

## Remove Horizontal Line in please's output

1.Navigate to `~/.config/please`  
2. Open config.json  
3. Change `"diable_line": false` to `"diable_line": true` (All lowercase).

## Remove Quotes in please's output

1.Navigate to `~/.config/please`  
2. Open config.json  
3. Change `"diable_quotes": false` to `"diable_quotes": true` (All lowercase).

# 💻 Local Development

1. To get started, first install poetry:

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

2. Clone this project
3. `cd` to the project directory and run virtual environment:

```bash
poetry shell

# OR THIS, IF 'poetry shell' doesn't work

. "$(dirname $(poetry run which python))/activate"
```

4. Install all dependencies:

```bash
poetry install
```

- `please` will be available to use as a command in the virtual environment after using `poetry install`.

5. Finally, run the python script with:

```bash
python please/please.py
```

6. To build a WHL package:

```bash
poetry build
```

- The package will be generated in **dist** folder, you can then use pip to install the WHL file.

7. **For Nayam:** Publish the package with:

```
poetry publish -u <username> -p <password>
```

# 🚮 Uninstalling

Open your terminal and type:

```bash
pip uninstall please-cli
```

and also edit your **.zshrc** or **.bashrc** file and remove the line that says `please` at the end of the file.

# ♥ Credits

- Thanks to @CodePleaseRun & @guedesfelipe for their contributions.
- Thanks to @lukePeavey for the quotes.json file taken from quotable.io

#

<h4 align="center"> Made by TGS963 and NayamAmarshe with ⌨ and 🖱 </h4>
