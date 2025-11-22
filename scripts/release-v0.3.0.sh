#!/bin/bash

# TestMind v0.3.0 Release Script
# This script automates the release process for v0.3.0

set -e  # Exit on any error

echo "🚀 TestMind v0.3.0 Release Script"
echo "=================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Version Verification
echo "📋 Step 1: Verifying versions..."
echo "--------------------------------"

# Check root package.json
ROOT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
CLI_VERSION=$(grep -o '"version": "[^"]*"' packages/cli/package.json | cut -d'"' -f4)
CORE_VERSION=$(grep -o '"version": "[^"]*"' packages/core/package.json | cut -d'"' -f4)
SHARED_VERSION=$(grep -o '"version": "[^"]*"' packages/shared/package.json | cut -d'"' -f4)

echo "Root package:   $ROOT_VERSION"
echo "CLI package:    $CLI_VERSION"
echo "Core package:   $CORE_VERSION"
echo "Shared package: $SHARED_VERSION"
echo ""

if [ "$ROOT_VERSION" != "0.3.0" ] || [ "$CLI_VERSION" != "0.3.0" ] || [ "$CORE_VERSION" != "0.3.0" ] || [ "$SHARED_VERSION" != "0.3.0" ]; then
    print_error "Version mismatch! All packages must be at version 0.3.0"
    exit 1
fi

print_success "All versions unified at 0.3.0"
echo ""

# Step 2: Clean and Build
echo "🔨 Step 2: Building packages..."
echo "--------------------------------"

print_warning "Cleaning previous builds..."
pnpm clean || true

print_warning "Installing dependencies..."
pnpm install

print_warning "Building all packages..."
pnpm build

print_success "Build completed successfully"
echo ""

# Step 3: Run Tests
echo "🧪 Step 3: Running tests..."
echo "--------------------------------"

print_warning "Running test suite..."
if pnpm test; then
    print_success "All tests passed"
else
    print_warning "Some tests failed. Check test results."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Release cancelled by user"
        exit 1
    fi
fi
echo ""

# Step 4: Type Check
echo "📝 Step 4: Type checking..."
echo "--------------------------------"

print_warning "Running TypeScript type check..."
if pnpm typecheck; then
    print_success "Type check passed"
else
    print_error "Type check failed"
    exit 1
fi
echo ""

# Step 5: Git Status Check
echo "📂 Step 5: Checking Git status..."
echo "--------------------------------"

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    print_warning "Not on main/master branch!"
    read -p "Continue on branch '$CURRENT_BRANCH'? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Release cancelled by user"
        exit 1
    fi
fi

if [ -n "$(git status --porcelain)" ]; then
    print_warning "There are uncommitted changes"
    git status --short
    echo ""
    read -p "Commit these changes? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "chore: prepare for v0.3.0 release

- Unified all package versions to 0.3.0
- Archived development documents
- Updated documentation and references
- Created release materials"
        print_success "Changes committed"
    else
        print_error "Please commit or stash changes before releasing"
        exit 1
    fi
else
    print_success "Working directory clean"
fi
echo ""

# Step 6: Create Git Tag
echo "🏷️  Step 6: Creating Git tag..."
echo "--------------------------------"

if git rev-parse v0.3.0 >/dev/null 2>&1; then
    print_warning "Tag v0.3.0 already exists"
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d v0.3.0
        print_success "Deleted existing tag"
    else
        print_error "Release cancelled - tag already exists"
        exit 1
    fi
fi

git tag -a v0.3.0 -m "Release v0.3.0

Major improvements:
- Unified version across all packages (0.3.0)
- Production-grade observability infrastructure
- Multi-LLM support (OpenAI, Gemini, Anthropic, Ollama)
- Comprehensive Skills Framework documentation
- Canvas Mode for non-linear AI interaction
- Community building foundation

See GITHUB_RELEASE_NOTES_v0.3.0.md for full details."

print_success "Tag v0.3.0 created"
echo ""

# Step 7: Push to Remote
echo "🚀 Step 7: Pushing to remote..."
echo "--------------------------------"

read -p "Push commits and tags to origin? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Pushing commits..."
    git push origin "$CURRENT_BRANCH"
    
    print_warning "Pushing tag..."
    git push origin v0.3.0
    
    print_success "Successfully pushed to remote"
else
    print_warning "Skipped remote push"
    echo "You can manually push with:"
    echo "  git push origin $CURRENT_BRANCH"
    echo "  git push origin v0.3.0"
fi
echo ""

# Step 8: Release Summary
echo "✅ Release Preparation Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Visit: https://github.com/[your-username]/testmind/releases/new"
echo "2. Select tag: v0.3.0"
echo "3. Title: 'v0.3.0 - Foundation for v1.0'"
echo "4. Copy content from: GITHUB_RELEASE_NOTES_v0.3.0.md"
echo "5. Click 'Publish release'"
echo ""
echo "📋 Don't forget to:"
echo "- Check RELEASE_CHECKLIST_v0.3.0.md"
echo "- Announce on GitHub Discussions"
echo "- Update social media (if applicable)"
echo ""

print_success "Script completed successfully! 🎉"

