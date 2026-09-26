# Contributing to git2txt-cli

Thank you for your interest in contributing to git2txt-cli! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

1. Fork the repository
2. Create a new branch for your feature or fix
3. Make your changes
4. Submit a pull request

### Development Setup

1. Clone your fork:
```bash
git clone https://github.com/your-username/git2txt-cli.git
cd git2txt-cli
```

2. Install dependencies:
```bash
npm install
```

3. Create a branch:
```bash
git checkout -b feature/your-feature-name
```

### Coding Standards

- Use ES Modules (import/export)
- Follow existing code style
- Add comments for complex logic
- Maintain cross-platform compatibility
- Test your changes on different operating systems if possible

### Commit Messages

- Use clear and descriptive commit messages
- Start with a verb in present tense (e.g., "Add feature" not "Added feature")
- Reference issues when applicable

Example:
```
Add file size threshold configuration
- Implement --threshold flag
- Add validation for threshold value
- Update documentation
```

### Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the version number following [SemVer](http://semver.org/)
3. Ensure all tests pass
4. Link any related issues
5. Provide a clear description of your changes

### Testing

Before submitting a pull request:

1. Test your changes locally
2. Verify cross-platform compatibility
3. Check for any performance impacts
4. Ensure documentation is updated

### Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- System information (OS, Node.js version)
- Any relevant error messages or logs

## Project Structure

```
git2txt-cli/
├── index.js          # Main CLI entry point
├── package.json      # Project configuration
├── README.md         # Documentation
└── CONTRIBUTING.md   # This file
```

## License

By contributing to git2txt-cli, you agree that your contributions will be licensed under the MIT License.
