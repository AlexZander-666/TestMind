<template>
  <div class="login-form">
    <h2>{{ title }}</h2>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          data-testid="email-input"
          :disabled="loading"
          @blur="validateEmail"
        />
        <span v-if="emailError" class="error">{{ emailError }}</span>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          data-testid="password-input"
          :disabled="loading"
        />
        <span v-if="passwordError" class="error">{{ passwordError }}</span>
      </div>

      <button
        type="submit"
        data-testid="submit-button"
        :disabled="loading || !isFormValid"
      >
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Props
interface Props {
  title?: string;
  onSuccess?: (user: any) => void;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Login',
});

// Emits
const emit = defineEmits<{
  submit: [email: string, password: string];
  error: [message: string];
  success: [user: any];
}>();

// State
const email = ref('');
const password = ref('');
const loading = ref(false);
const emailError = ref('');
const passwordError = ref('');
const errorMessage = ref('');

// Computed
const isFormValid = computed(() => {
  return email.value.length > 0 && 
         password.value.length >= 6 && 
         !emailError.value &&
         !passwordError.value;
});

// Methods
function validateEmail() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.value) {
    emailError.value = 'Email is required';
  } else if (!emailRegex.test(email.value)) {
    emailError.value = 'Invalid email format';
  } else {
    emailError.value = '';
  }
}

async function handleSubmit() {
  validateEmail();
  
  if (!isFormValid.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  
  emit('submit', email.value, password.value);

  try {
    // Simulated API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user = { email: email.value, id: '123' };
    emit('success', user);
    
    if (props.onSuccess) {
      props.onSuccess(user);
    }
  } catch (error: any) {
    errorMessage.value = error.message || 'Login failed';
    emit('error', errorMessage.value);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

input:disabled {
  background-color: #f5f5f5;
}

button {
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error {
  color: red;
  font-size: 12px;
}

.error-message {
  color: red;
  margin-top: 10px;
}
</style>

