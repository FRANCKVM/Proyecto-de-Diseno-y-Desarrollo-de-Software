package pucp.edu.pe.tasfb2b;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class Tasfb2bApplication {
    public static void main(String[] args) {
        SpringApplication.run(Tasfb2bApplication.class, args);
    }
}