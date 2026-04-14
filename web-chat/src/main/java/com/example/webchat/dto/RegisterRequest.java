package com.example.webchat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(min = 2, max = 64) String username,
        @NotBlank @Size(min = 6, max = 128) String password
) {}
