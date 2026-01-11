/**
 * create-toonstore-app
 * 
 * Interactive installer for ToonStore suite (ToonStoreDB + TORM)
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Types
type DeploymentChoice = 'local' | 'cloud';
type LocalMethod = 'docker' | 'binary' | 'compose' | 'source' | 'embedded';
type CloudProvider = 'aws' | 'gcp' | 'azure' | 'coolify' | 'dockploy' | 'railway' | 'digitalocean' | 'render' | 'flyio';
type Language = 'nodejs' | 'python' | 'go' | 'php';

interface InstallationConfig {
  deployment: DeploymentChoice;
  localMethod?: LocalMethod;
  cloudProvider?: CloudProvider;
  connectionString: string;
  language: Language;
  packageManager?: string;
}

// Utility functions
function detectLanguage(): Language | null {
  if (existsSync('package.json')) return 'nodejs';
  if (existsSync('requirements.txt') || existsSync('pyproject.toml')) return 'python';
  if (existsSync('go.mod')) return 'go';
  if (existsSync('composer.json')) return 'php';
  return null;
}

async function checkCommand(command: string): Promise<boolean> {
  try {
    await execa(command, ['--version']);
    return true;
  } catch {
    return false;
  }
}

function getOSType(): 'linux' | 'macos' | 'windows' {
  const platform = os.platform();
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

// Installation methods
async function installDocker(connectionString: string): Promise<void> {
  const spinner = ora('Checking Docker installation...').start();
  
  const hasDocker = await checkCommand('docker');
  if (!hasDocker) {
    spinner.fail('Docker not found!');
    console.log(chalk.yellow('\n📥 Install Docker: https://docs.docker.com/get-docker/\n'));
    process.exit(1);
  }
  
  spinner.text = 'Pulling ToonStoreDB image...';
  await execa('docker', ['pull', 'toonstore/toonstoredb:latest']);
  
  spinner.text = 'Starting ToonStoreDB container...';
  await execa('docker', [
    'run', '-d',
    '--name', 'toonstoredb',
    '-p', '6379:6379',
    '-v', 'toonstore-data:/data',
    'toonstore/toonstoredb:latest'
  ]);
  
  spinner.succeed('ToonStoreDB running on localhost:6379');
}

async function installBinary(connectionString: string): Promise<void> {
  const spinner = ora('Downloading ToonStoreDB binary...').start();
  
  const osType = getOSType();
  const binaryName = osType === 'windows' ? 'toonstoredb.exe' : 'toonstoredb';
  const downloadUrl = `https://github.com/kalama-tech/toonstoredb/releases/latest/download/toonstoredb-${osType}${osType === 'windows' ? '.exe' : ''}`;
  
  try {
    await execa('curl', ['-fsSL', downloadUrl, '-o', binaryName]);
    if (osType !== 'windows') {
      await execa('chmod', ['+x', binaryName]);
    }
    
    spinner.text = 'Installing to system PATH...';
    const installPath = osType === 'windows' ? 'C:\\Program Files\\ToonStore' : '/usr/local/bin';
    await execa(osType === 'windows' ? 'move' : 'sudo mv', [binaryName, join(installPath, binaryName)]);
    
    spinner.text = 'Starting ToonStoreDB...';
    execa(binaryName, ['--port', '6379', '--capacity', '10000'], { detached: true });
    
    spinner.succeed('ToonStoreDB installed and running');
  } catch (error) {
    spinner.fail('Failed to install binary');
    throw error;
  }
}

async function installCompose(connectionString: string): Promise<void> {
  const spinner = ora('Creating docker-compose.yml...').start();
  
  const composeContent = `version: '3.8'
services:
  toonstoredb:
    image: toonstore/toonstoredb:latest
    container_name: toonstoredb
    ports:
      - "6379:6379"
    volumes:
      - toonstore-data:/data
    environment:
      - CAPACITY=10000
    restart: unless-stopped

volumes:
  toonstore-data:
`;
  
  writeFileSync('docker-compose.yml', composeContent);
  
  spinner.text = 'Starting services...';
  await execa('docker-compose', ['up', '-d']);
  
  spinner.succeed('ToonStoreDB running via Docker Compose');
}

async function installFromSource(connectionString: string): Promise<void> {
  const spinner = ora('Checking for Rust toolchain...').start();
  
  const hasRust = await checkCommand('cargo');
  if (!hasRust) {
    spinner.text = 'Installing Rust...';
    await execa('curl', ['--proto', '=https', '--tlsv1.2', '-sSf', 'https://sh.rustup.rs'], { shell: true });
  }
  
  spinner.text = 'Cloning repository...';
  await execa('git', ['clone', 'https://github.com/kalama-tech/toonstoredb.git']);
  
  spinner.text = 'Building from source (this may take a while)...';
  await execa('cargo', ['build', '--release'], { cwd: 'toonstoredb' });
  
  spinner.text = 'Installing...';
  await execa('sudo', ['cp', 'target/release/toonstoredb', '/usr/local/bin/']);
  
  spinner.text = 'Starting ToonStoreDB...';
  execa('toonstoredb', ['--port', '6379'], { detached: true });
  
  spinner.succeed('ToonStoreDB built and running');
}

async function installEmbedded(connectionString: string): Promise<void> {
  const spinner = ora('Adding ToonStoreDB to Cargo.toml...').start();
  
  if (!existsSync('Cargo.toml')) {
    spinner.fail('No Cargo.toml found. This option is for Rust projects only.');
    process.exit(1);
  }
  
  await execa('cargo', ['add', 'toonstoredb']);
  
  const exampleCode = `use toonstoredb::ToonStoreDB;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db = ToonStoreDB::new("./data", 10000)?;
    
    db.set("mykey", "myvalue").await?;
    let value = db.get("mykey").await?;
    
    println!("Value: {:?}", value);
    Ok(())
}`;
  
  writeFileSync('src/main.rs', exampleCode);
  
  spinner.succeed('ToonStoreDB added as embedded library');
  console.log(chalk.cyan('\n📝 Example code written to src/main.rs'));
}

// Cloud provider guides
const cloudProviders = {
  aws: {
    name: 'AWS (Amazon Web Services)',
    steps: [
      '1. Launch EC2 instance (t3.medium recommended)',
      '2. Install Docker: sudo yum install docker -y',
      '3. Start Docker: sudo systemctl start docker',
      '4. Run ToonStore: docker run -d -p 6379:6379 toonstore/toonstoredb:latest',
      '5. Configure security group to allow port 6379',
      '6. Use public IP as connection string'
    ],
    docs: 'https://docs.mytoon.store/cloud/aws'
  },
  gcp: {
    name: 'Google Cloud Platform',
    steps: [
      '1. Create Compute Engine instance',
      '2. Install Docker via startup script',
      '3. Deploy ToonStore container',
      '4. Configure firewall rules',
      '5. Use external IP for connection'
    ],
    docs: 'https://docs.mytoon.store/cloud/gcp'
  },
  azure: {
    name: 'Microsoft Azure',
    steps: [
      '1. Create Azure Container Instance',
      '2. Use image: toonstore/toonstoredb:latest',
      '3. Expose port 6379',
      '4. Configure networking',
      '5. Use FQDN for connection'
    ],
    docs: 'https://docs.mytoon.store/cloud/azure'
  },
  coolify: {
    name: 'Coolify',
    steps: [
      '1. Add new service in Coolify',
      '2. Select Docker Image deployment',
      '3. Image: toonstore/toonstoredb:latest',
      '4. Add port mapping: 6379:6379',
      '5. Deploy and get connection URL'
    ],
    docs: 'https://docs.mytoon.store/cloud/coolify'
  },
  dockploy: {
    name: 'Dockploy',
    steps: [
      '1. Create new application',
      '2. Choose Docker deployment',
      '3. Image: toonstore/toonstoredb:latest',
      '4. Map port 6379',
      '5. Deploy and connect'
    ],
    docs: 'https://docs.mytoon.store/cloud/dockploy'
  },
  railway: {
    name: 'Railway',
    steps: [
      '1. New Project → Deploy Docker Image',
      '2. Image: toonstore/toonstoredb:latest',
      '3. Add PORT variable: 6379',
      '4. Railway generates public URL',
      '5. Use Railway URL in connection string'
    ],
    docs: 'https://docs.mytoon.store/cloud/railway'
  },
  digitalocean: {
    name: 'DigitalOcean',
    steps: [
      '1. Create Droplet with Docker',
      '2. SSH into droplet',
      '3. Run: docker run -d -p 6379:6379 toonstore/toonstoredb:latest',
      '4. Configure firewall',
      '5. Use droplet IP for connection'
    ],
    docs: 'https://docs.mytoon.store/cloud/digitalocean'
  },
  render: {
    name: 'Render',
    steps: [
      '1. Create new Web Service',
      '2. Use Docker image: toonstore/toonstoredb:latest',
      '3. Set port to 6379',
      '4. Deploy',
      '5. Use Render URL for connection'
    ],
    docs: 'https://docs.mytoon.store/cloud/render'
  },
  flyio: {
    name: 'Fly.io',
    steps: [
      '1. Install flyctl CLI',
      '2. Run: fly launch',
      '3. Select Docker deployment',
      '4. Image: toonstore/toonstoredb:latest',
      '5. Deploy and get connection URL'
    ],
    docs: 'https://docs.mytoon.store/cloud/flyio'
  }
};

async function showCloudGuide(provider: CloudProvider): Promise<string> {
  const guide = cloudProviders[provider];
  
  console.log(chalk.bold.cyan(`\n📚 ${guide.name} Deployment Guide:\n`));
  guide.steps.forEach(step => console.log(chalk.white(`   ${step}`)));
  console.log(chalk.gray(`\n📖 Full documentation: ${guide.docs}\n`));
  
  const { continueLocal } = await inquirer.prompt([{
    type: 'confirm',
    name: 'continueLocal',
    message: 'Deploy to cloud manually and continue with TORM installation?',
    default: true
  }]);
  
  if (!continueLocal) {
    console.log(chalk.yellow('\nInstallation cancelled. Come back when your database is deployed!'));
    process.exit(0);
  }
  
  const { connectionString } = await inquirer.prompt([{
    type: 'input',
    name: 'connectionString',
    message: 'Enter your ToonStoreDB connection string:',
    default: `toonstore://${provider}-instance:6379`,
    validate: (input: string) => {
      return input.startsWith('toonstore://') || 'Must start with toonstore://';
    }
  }]);
  
  return connectionString;
}

// SDK installers
async function installNodeJS(connectionString: string): Promise<void> {
  const spinner = ora('Installing @toonstore/torm...').start();
  
  // Detect package manager
  let packageManager = 'npm';
  if (existsSync('package-lock.json')) packageManager = 'npm';
  else if (existsSync('yarn.lock')) packageManager = 'yarn';
  else if (existsSync('pnpm-lock.yaml')) packageManager = 'pnpm';
  else if (existsSync('bun.lockb')) packageManager = 'bun';
  
  spinner.text = `Installing with ${packageManager}...`;
  await execa(packageManager, ['add', '@toonstore/torm']);
  
  // Check for TypeScript
  if (existsSync('tsconfig.json')) {
    spinner.text = 'Installing TypeScript dependencies...';
    await execa(packageManager, ['add', '-D', 'tsx', 'typescript', '@types/node']);
  }
  
  // Create config file
  const configContent = `export default {
  dbCredentials: {
    url: '${connectionString}',
    // Or use individual options:
    // host: 'localhost',
    // port: 6379,
  },
  studio: {
    port: 4983,
  },
};
`;
  
  writeFileSync('torm.config.ts', configContent);
  
  // Create example file
  const exampleContent = `import { TormClient } from '@toonstore/torm';

const torm = new TormClient({
  url: '${connectionString}'
});

interface User {
  name: string;
  email: string;
  age: number;
}

const User = torm.model<User>('User', {
  name: { type: 'string', required: true },
  email: { type: 'string', email: true },
  age: { type: 'number', min: 0 }
});

async function main() {
  const user = await User.create({
    name: 'Alice',
    email: 'alice@example.com',
    age: 30
  });
  
  console.log('Created user:', user._id);
}

main();
`;
  
  writeFileSync('example.ts', exampleContent);
  
  // Add scripts to package.json
  if (existsSync('package.json')) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts['torm:studio'] = 'torm studio';
    pkg.scripts['torm:migrate'] = 'torm migrate';
    writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  }
  
  spinner.succeed('TORM SDK installed successfully!');
}

async function installPython(connectionString: string): Promise<void> {
  const spinner = ora('Installing toonstore-torm...').start();
  
  await execa('pip', ['install', 'toonstore-torm']);
  
  // Create config file
  const configContent = `from toonstore_torm import TormClient

torm = TormClient('${connectionString}')
`;
  
  writeFileSync('torm_config.py', configContent);
  
  // Create example file
  const exampleContent = `from toonstore_torm import TormClient

torm = TormClient('${connectionString}')

User = torm.model('User', {
    'name': {'type': 'str', 'required': True},
    'email': {'type': 'str', 'email': True},
    'age': {'type': 'int', 'min': 0}
})

user = User.create({
    'id': 'user:1',
    'name': 'Alice',
    'email': 'alice@example.com',
    'age': 30
})

print(f'Created user: {user["id"]}')
`;
  
  writeFileSync('example.py', exampleContent);
  
  spinner.succeed('TORM SDK installed successfully!');
}

async function installGo(connectionString: string): Promise<void> {
  const spinner = ora('Installing toonstore-torm-go...').start();
  
  if (!existsSync('go.mod')) {
    const projectName = process.cwd().split('/').pop() || 'myproject';
    await execa('go', ['mod', 'init', projectName]);
  }
  
  await execa('go', ['get', 'github.com/toonstore/torm-go']);
  
  // Create example file
  const exampleContent = `package main

import (
    "fmt"
    "github.com/toonstore/torm-go"
)

type User struct {
    ID    string \`json:"id"\`
    Name  string \`json:"name"\`
    Email string \`json:"email"\`
    Age   int    \`json:"age"\`
}

func (u *User) GetID() string { return u.ID }
func (u *User) SetID(id string) { u.ID = id }
func (u *User) ToMap() map[string]interface{} {
    return map[string]interface{}{
        "id": u.ID, "name": u.Name, "email": u.Email, "age": u.Age,
    }
}

func main() {
    client := torm.NewClient("${connectionString}")
    users := torm.NewCollection(client, "users", func() *User { return &User{} })
    
    user := &User{
        ID:    "user:1",
        Name:  "Alice",
        Email: "alice@example.com",
        Age:   30,
    }
    
    created, err := users.Create(user)
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Created user: %s\\n", created.ID)
}
`;
  
  writeFileSync('example.go', exampleContent);
  
  await execa('go', ['mod', 'tidy']);
  
  spinner.succeed('TORM SDK installed successfully!');
}

async function installPHP(connectionString: string): Promise<void> {
  const spinner = ora('Installing toonstore/torm...').start();
  
  const hasComposer = await checkCommand('composer');
  if (!hasComposer) {
    spinner.fail('Composer not found!');
    console.log(chalk.yellow('\n📥 Install Composer: https://getcomposer.org/download/\n'));
    process.exit(1);
  }
  
  await execa('composer', ['require', 'toonstore/torm']);
  
  // Create example file
  const exampleContent = `<?php

require_once __DIR__ . '/vendor/autoload.php';

use Toonstore\\Torm\\TormClient;

$torm = new TormClient('${connectionString}');

$User = $torm->model('User', [
    'name' => ['type' => 'string', 'required' => true],
    'email' => ['type' => 'string', 'email' => true],
    'age' => ['type' => 'integer', 'min' => 0]
]);

$user = $User->create([
    'id' => 'user:1',
    'name' => 'Alice',
    'email' => 'alice@example.com',
    'age' => 30
]);

echo "Created user: {$user['id']}\\n";
`;
  
  writeFileSync('example.php', exampleContent);
  
  spinner.succeed('TORM SDK installed successfully!');
}

// Main installation flow
export async function main() {
  console.log(chalk.bold.cyan('\n🎨 Welcome to ToonStore Suite Installer\n'));
  console.log(chalk.white('This will guide you through installing:'));
  console.log(chalk.white('  • ToonStoreDB (Database + Cache)'));
  console.log(chalk.white('  • TORM (ORM with Studio)\n'));
  
  // Step 1: Deployment choice
  const { deployment } = await inquirer.prompt([{
    type: 'list',
    name: 'deployment',
    message: 'Where do you want to deploy ToonStoreDB?',
    choices: [
      { name: 'Local (Install on this machine)', value: 'local' },
      { name: 'Cloud (Deploy to cloud provider)', value: 'cloud' }
    ]
  }]);
  
  let connectionString = 'toonstore://localhost:6379';
  
  if (deployment === 'local') {
    // Step 2a: Local installation method
    const osType = getOSType();
    const dockerNote = osType === 'windows' 
      ? 'Docker (Recommended - Docker Desktop must be running on Windows)'
      : 'Docker (Recommended - Docker daemon must be running)';
    
    const { localMethod } = await inquirer.prompt([{
      type: 'list',
      name: 'localMethod',
      message: 'How do you want to install ToonStoreDB locally?',
      choices: [
        { name: dockerNote, value: 'docker' },
        { name: 'Binary (Pre-built executable)', value: 'binary' },
        { name: 'Docker Compose (Multi-container setup)', value: 'compose' },
        { name: 'Build from Source (Latest features)', value: 'source' },
        { name: 'Embedded Library (Rust projects only)', value: 'embedded' }
      ]
    }]);
    
    switch (localMethod) {
      case 'docker':
        await installDocker(connectionString);
        break;
      case 'binary':
        await installBinary(connectionString);
        break;
      case 'compose':
        await installCompose(connectionString);
        break;
      case 'source':
        await installFromSource(connectionString);
        break;
      case 'embedded':
        await installEmbedded(connectionString);
        console.log(chalk.green('\n✅ Installation complete!'));
        process.exit(0);
    }
  } else {
    // Step 2b: Cloud provider guide
    const { cloudProvider } = await inquirer.prompt([{
      type: 'list',
      name: 'cloudProvider',
      message: 'Select your cloud provider:',
      choices: [
        { name: 'AWS (Amazon Web Services)', value: 'aws' },
        { name: 'GCP (Google Cloud Platform)', value: 'gcp' },
        { name: 'Azure (Microsoft Azure)', value: 'azure' },
        { name: 'Coolify (Self-hosted PaaS)', value: 'coolify' },
        { name: 'Dockploy (Docker deployment)', value: 'dockploy' },
        { name: 'Railway', value: 'railway' },
        { name: 'DigitalOcean', value: 'digitalocean' },
        { name: 'Render', value: 'render' },
        { name: 'Fly.io', value: 'flyio' }
      ]
    }]);
    
    connectionString = await showCloudGuide(cloudProvider);
  }
  
  // Step 3: Language selection
  const detectedLang = detectLanguage();
  let language: Language;
  
  if (detectedLang) {
    console.log(chalk.cyan(`\n📦 Detected ${detectedLang} project\n`));
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Install TORM for ${detectedLang}?`,
      default: true
    }]);
    
    if (confirm) {
      language = detectedLang;
    } else {
      const { selectedLang } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedLang',
        message: 'Select your programming language:',
        choices: [
          { name: 'Node.js / TypeScript', value: 'nodejs' },
          { name: 'Python', value: 'python' },
          { name: 'Go', value: 'go' },
          { name: 'PHP', value: 'php' }
        ]
      }]);
      language = selectedLang;
    }
  } else {
    const { selectedLang } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedLang',
      message: 'What programming language is your project using?',
      choices: [
        { name: 'Node.js / TypeScript', value: 'nodejs' },
        { name: 'Python', value: 'python' },
        { name: 'Go', value: 'go' },
        { name: 'PHP', value: 'php' }
      ]
    }]);
    language = selectedLang;
  }
  
  // Step 4: Install SDK
  console.log();
  switch (language) {
    case 'nodejs':
      await installNodeJS(connectionString);
      break;
    case 'python':
      await installPython(connectionString);
      break;
    case 'go':
      await installGo(connectionString);
      break;
    case 'php':
      await installPHP(connectionString);
      break;
  }
  
  // Step 5: Success message
  console.log(chalk.bold.green('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.bold.green('║  ✅ ToonStore Suite Installation Complete!    ║'));
  console.log(chalk.bold.green('╚════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.bold('🗄️  ToonStoreDB'));
  console.log(chalk.white(`   Status: ${chalk.green('✅ Running')}`));
  console.log(chalk.white(`   Connection: ${connectionString}\n`));
  
  console.log(chalk.bold('🔧 TORM SDK'));
  console.log(chalk.white(`   Language: ${language}`));
  console.log(chalk.white(`   Config: ${language === 'nodejs' ? 'torm.config.ts' : language === 'python' ? 'torm_config.py' : language === 'go' ? 'example.go' : 'example.php'}\n`));
  
  console.log(chalk.bold('🚀 Next Steps:\n'));
  
  if (language === 'nodejs') {
    console.log(chalk.white('   1. Start TORM Studio:'));
    console.log(chalk.cyan('      $ npm run torm:studio\n'));
    console.log(chalk.white('   2. Run the example:'));
    console.log(chalk.cyan('      $ tsx example.ts\n'));
  } else if (language === 'python') {
    console.log(chalk.white('   1. Run the example:'));
    console.log(chalk.cyan('      $ python example.py\n'));
  } else if (language === 'go') {
    console.log(chalk.white('   1. Run the example:'));
    console.log(chalk.cyan('      $ go run example.go\n'));
  } else if (language === 'php') {
    console.log(chalk.white('   1. Run the example:'));
    console.log(chalk.cyan('      $ php example.php\n'));
  }
  
  console.log(chalk.bold('📚 Documentation'));
  console.log(chalk.white('   Website: https://docs.mytoon.store'));
  console.log(chalk.white('   TORM: https://github.com/kalama-tech/torm'));
  console.log(chalk.white('   ToonStoreDB: https://github.com/Kalama-Tech/toonstoredb\n'));
  
  console.log(chalk.bold.cyan('Happy coding! 🎉\n'));
}
