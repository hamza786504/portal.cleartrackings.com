
  <style>
    body { background-color: #f8f9fa; }
    .login-box {
      max-width: 400px;
      margin: auto;
      margin-top: 80px;
      padding: 30px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 0 15px rgba(0,0,0,0.1);
    }
  </style>


<div class="container">
  <div class="login-box">
            <div class="text-center mb-4">
                <img src="../AdamISlogo.png" alt="AdamIS Portal" height="60" class="mb-3">
                <h3 class="text-primary">AdamIS Portal Login</h3>
            </div>

        
    
    <form method="post">
      <input type="hidden" name="csrf_token" value="139be62ce62527cd45f33cb0e97313e5b7d793a6746432b48b8a0d598f80ba7c">
      <div class="mb-3">
        <label for="email" class="form-label">Email address</label>
        <input type="email" name="email" class="form-control" id="email" required autofocus>
      </div>

      <div class="mb-3">
        <label for="password" class="form-label">Password</label>
        <input type="password" name="password" class="form-control" id="password" required>
      </div>

      <button type="submit" class="btn btn-primary w-100">Login</button>
    </form>

    <div class="text-center mt-3">
      <small><a href="forgot-password" class="text-decoration-none">Forgot Password?</a></small>
    </div>
    <div class="text-center mt-2">
      <small>New doctor? <a href="doctor-signup" class="text-decoration-none">Request an account</a></small>
    </div>
  </div>
</div>
