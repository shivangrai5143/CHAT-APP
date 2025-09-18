import React from 'react'
import "./login.css"
import assets from '../../assets/assets'
const login = () => {
  return (
    <div className='login'>
      <img src={assets.logo_big} alt="" className='logo'/>
       <form  className="login-form">
        <h2>Sign Up</h2>
        <input type="text" placeholder='Username' className='form-input' required />
        <input type="email" placeholder='Email' className='form-input' required />
        <input type="password" placeholder='Password'  className='form-input' required />
        <button type="submit">Sign Up</button>
        <div className="login-term">
          <input type ="checkbox"/>
          <p>Agree to the terms of use & privacy policy</p>
          <div className="login-forgot">
            <p class = "login-toggle">Already have an account <span>click here</span></p>
          </div>
        </div>
       </form>
    </div>
  )
}

export default login
