package com.example.webchat;

import com.example.webchat.dto.ChannelResponse;
import com.example.webchat.dto.CreateChannelRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/channels")
public class ChannelController {

    private final ChannelService channelService;

    public ChannelController(ChannelService channelService) {
        this.channelService = channelService;
    }

    @GetMapping
    public List<ChannelResponse> list() {
        return channelService.listAll();
    }

    @PostMapping
    public ChannelResponse create(@Valid @RequestBody CreateChannelRequest request, Principal principal) {
        String username = principal != null ? principal.getName() : "user";
        return channelService.create(request, username);
    }
}
