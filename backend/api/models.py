from django.db import models


class Posting(models.Model):
    job_id = models.IntegerField(primary_key=True)
    company_name = models.CharField(max_length=300)
    title = models.CharField(max_length=300)
    description = models.TextField()
    location = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        managed = False
        db_table = "postings"
